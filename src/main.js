import { GLContext, Program, VertexArray, Buffer } from './webgl/index.js';
import { loadShaders } from './shaders/loader.js';
import { TextPathGPU } from './textPath.js';

let PARTICLE_COUNT = 250000; 

let simulationRunning = false;
let animationId = null;

function createParticleData(particleCount) {
    const positions = new Float32Array(particleCount * 2);
    const velocities = new Float32Array(particleCount * 2);
    const types = new Float32Array(particleCount);

    const aspectRatio = 1920.0 / 1080.0;

    // Helper function for gaussian random distribution (Box-Muller transform)
    function gaussianRandom(mean = 0, stdDev = 1) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return z0 * stdDev + mean;
    }

    for (let i = 0; i < particleCount; i++) {
        const x = gaussianRandom(0, 0.5) * aspectRatio;
        const y = gaussianRandom(0, 0.5);
        
        positions[i * 2]     = x;
        positions[i * 2 + 1] = y;

        velocities[i * 2] = (Math.random() * 2 - 1) * 0.1;
        velocities[i * 2 + 1] = (Math.random() * 2 - 1) * 0.1;

        
        types[i] = Math.floor(Math.random() * 3); // Random type 0, 1, or 2
    }

    return { positions, velocities, types };
}

function openTextureInNewWindow(texture, title) {
    const gl = texture.gl;
    const width = texture.width;
    const height = texture.height;
    
    const pixels = new Uint8Array(width * height * 4);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture.texture, 0);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const srcIdx = (y * width + x) * 4;
            const dstIdx = ((height - 1 - y) * width + x) * 4; // Flip Y
            imageData.data[dstIdx + 0] = pixels[srcIdx + 0];
            imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
            imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
            imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
        }
    }
    ctx.putImageData(imageData, 0, 0);
    
    const newWindow = window.open('', '_blank', `width=${width * 4},height=${height * 4 + 50}`);
    if (newWindow) {
        newWindow.document.title = title;
        newWindow.document.body.style.margin = '0';
        newWindow.document.body.style.display = 'flex';
        newWindow.document.body.style.flexDirection = 'column';
        newWindow.document.body.style.justifyContent = 'center';
        newWindow.document.body.style.alignItems = 'center';
        newWindow.document.body.style.backgroundColor = '#000';
        
        const heading = newWindow.document.createElement('h2');
        heading.textContent = title;
        heading.style.color = '#fff';
        heading.style.fontFamily = 'Arial, sans-serif';
        heading.style.margin = '10px';
        newWindow.document.body.appendChild(heading);
        
        const img = newWindow.document.createElement('img');
        img.src = canvas.toDataURL();
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.imageRendering = 'pixelated';
        newWindow.document.body.appendChild(img);
        
    } else {
        console.error('Failed to open new window.');
    }
}

async function start() {
    const canvas = document.getElementById('glcanvas');
    if (!canvas) {
        console.error('Canvas element with id "glcanvas" not found.');
        return;
    }

    const glContext = new GLContext(canvas, {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance"
    });

    const fixedWidth = 1920;
    const fixedHeight = 1080;
    
    canvas.width = fixedWidth;
    canvas.height = fixedHeight;
    canvas.style.width = fixedWidth + 'px';
    canvas.style.height = fixedHeight + 'px';
    
    glContext.resize(fixedWidth, fixedHeight);

    const gl = glContext.getContext();
    glContext.setDepthTest(false);
    glContext.setClearColor(0.0, 0.0, 0.0, 1.0);
    
    // Enable blending for particle overlaps
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_COLOR);

    
    const shaders = await loadShaders({
        vertex: './src/shaders/triangle.vert',
        fragment: './src/shaders/triangle.frag',
        computeVertex: './src/shaders/compute.vert',
        computeFragment: './src/shaders/compute.frag',
        blurVertex: './src/shaders/blur.vert',
        blurFragment: './src/shaders/blur.frag',
        blendFragment: './src/shaders/blend.frag',
        normalMapFragment: './src/shaders/normalmap.frag',
        edgeFragment: './src/shaders/edge.frag'
    });

    const renderProgram = new Program(gl, shaders.vertex, shaders.fragment);

    
    const computeProgram = new Program(gl, shaders.computeVertex, shaders.computeFragment, {
        transformFeedbackVaryings: ['v_newPosition', 'v_newVelocity', 'v_newType']
    });

    const { positions, velocities, types } = createParticleData(PARTICLE_COUNT);
    
    const buffer1 = new Buffer(gl, {
        data: new Float32Array(PARTICLE_COUNT * 5),
        usage: gl.DYNAMIC_DRAW
    });
    const buffer2 = new Buffer(gl, {
        data: new Float32Array(PARTICLE_COUNT * 5),
        usage: gl.DYNAMIC_DRAW
    });
    
    // Initialize particle data
    const initialData = new Float32Array(PARTICLE_COUNT * 5);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        initialData[i * 5 + 0] = positions[i * 2 + 0];     
        initialData[i * 5 + 1] = positions[i * 2 + 1];     
        initialData[i * 5 + 2] = velocities[i * 2 + 0];    
        initialData[i * 5 + 3] = velocities[i * 2 + 1];    
        initialData[i * 5 + 4] = types[i];        
    }
    
    buffer1.updateData(initialData);

    
    const renderVAO1 = new VertexArray(gl);
    const renderVAO2 = new VertexArray(gl);
    const computeVAO1 = new VertexArray(gl);
    const computeVAO2 = new VertexArray(gl);
    
    function setupVAO(vao, buffer, program) {
        const stride = 5 * 4; 
        const posLoc = program.getAttributeLocation('a_position');
        const velLoc = program.getAttributeLocation('a_velocity');
        const typeLoc = program.getAttributeLocation('a_type');
        
        if (posLoc !== -1) {
            vao.addAttributeWithStride(posLoc, buffer.getBuffer(), 2, stride, 0);
        }
        if (velLoc !== -1) {
            vao.addAttributeWithStride(velLoc, buffer.getBuffer(), 2, stride, 8);
        }
        if (typeLoc !== -1) {
            vao.addAttributeWithStride(typeLoc, buffer.getBuffer(), 1, stride, 16);
        }
    }

    setupVAO(renderVAO1, buffer1, renderProgram);
    setupVAO(renderVAO2, buffer2, renderProgram);
    setupVAO(computeVAO1, buffer1, computeProgram);
    setupVAO(computeVAO2, buffer2, computeProgram);

    // Create transform feedbacks
    const tf1 = gl.createTransformFeedback();
    const tf2 = gl.createTransformFeedback();

    // Bind buffers to transform feedback
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf1);
    buffer1.bindBase(0);
    
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf2);
    buffer2.bindBase(0);
    
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    
    let currentBuffer = 0; 

    const fixedDeltaTime = 1.0 / 60.0; // Fixed 60 FPS
    let frameCount = 0;
    let lastFpsTime = performance.now();
    
    function render() {
        frameCount += 1;
        const currentTime = performance.now();
        const timeSinceLastFps = currentTime - lastFpsTime;
        
        if (timeSinceLastFps >= 2000) {
            const fps = (frameCount * 1000) / timeSinceLastFps;
            console.log(`FPS: ${fps.toFixed(1)}`);
            frameCount = 0;
            lastFpsTime = currentTime;
        }
        
        const aspectRatio = canvas.width / canvas.height;
        
        computeProgram.use();
        computeProgram.setUniform('u_deltaTime', fixedDeltaTime); 
        computeProgram.setUniform('u_time', frameCount * fixedDeltaTime);
        
        computeProgram.setUniform('u_textAttraction', 0);

        
        gl.enable(gl.RASTERIZER_DISCARD);
        
        const currentComputeVAO = currentBuffer === 0 ? computeVAO1 : computeVAO2;
        const currentTF = currentBuffer === 0 ? tf2 : tf1;
        
        
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, currentTF);
        
        
        currentComputeVAO.bind();
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);
        gl.endTransformFeedback();
        
        
        currentComputeVAO.unbind();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        
        
        gl.disable(gl.RASTERIZER_DISCARD);

        gl.viewport(0, 0, canvas.width, canvas.height);
        
        glContext.clear();
        renderProgram.use();
        renderProgram.setUniform('u_pointSize', 1.5);
        
        renderProgram.setUniform('u_aspectRatio', aspectRatio);
        
        
        const renderVAO = currentBuffer === 0 ? renderVAO2 : renderVAO1;
        renderVAO.draw(gl.POINTS, PARTICLE_COUNT);

        
        currentBuffer = 1 - currentBuffer;

        if (simulationRunning) {
            requestAnimationFrame(render);
        }
    }

    simulationRunning = true;
    requestAnimationFrame(render);
}

document.addEventListener('DOMContentLoaded', () => {
    start().catch((error) => {
        console.error('Failed to start GPU particle demo:', error);
    });
});
