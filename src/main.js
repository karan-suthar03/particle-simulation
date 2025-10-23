import { GLContext, Program, VertexArray } from './webgl/index.js';
import { loadShaders } from './shaders/loader.js';

let PARTICLE_COUNT = 250000; 


let simulationRunning = false;
let animationId = null;

function createParticleData(particleCount) {
    const positions = new Float32Array(particleCount * 2);
    const velocities = new Float32Array(particleCount * 2);
    const colors = new Float32Array(particleCount * 3);

    
    const gridSize = Math.ceil(Math.sqrt(particleCount));
    const spacing = 4.0 / gridSize; 

    for (let i = 0; i < particleCount; i++) {
        const gridX = i % gridSize;
        const gridY = Math.floor(i / gridSize);

        
        positions[i * 2]     = -2.0 + gridX * spacing + spacing * 0.5;
        positions[i * 2 + 1] = -2.0 + gridY * spacing + spacing * 0.5;

        velocities[i * 2] = (Math.random() * 2 - 1)*0.001 ;
        velocities[i * 2 + 1] = (Math.random() * 2 - 1)*0.001;

        
        

        colors[i * 3] = Math.random();
        colors[i * 3 + 1] = Math.random();
        colors[i * 3 + 2] = Math.random();
    }

    return { positions, velocities, colors };
}

function createBuffer(gl, data, usage = gl.STATIC_DRAW) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    return buffer;
}

function createTransformFeedback(gl) {
    return gl.createTransformFeedback();
}

async function start() {
    const canvas = document.getElementById('glcanvas');
    if (!canvas) {
        console.error('Canvas element with id "glcanvas" not found.');
        return;
    }

    
    let mouseX = 10.0; 
    let mouseY = 10.0; 
    let mouseInitialized = false;

    function updatePosition(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        
        mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouseY = -(((clientY - rect.top) / rect.height) * 2 - 1); 
        mouseInitialized = true;
    }

    function updateMousePosition(event) {
        updatePosition(event.clientX, event.clientY);
    }

    function updateTouchPosition(event) {
        event.preventDefault(); 
        if (event.touches.length > 0) {
            
            const touch = event.touches[0];
            updatePosition(touch.clientX, touch.clientY);
        }
    }

    function handleTouchEnd(event) {
        event.preventDefault();
        if (event.touches.length === 0) {
            
            mouseX = 1000.0;
            mouseY = 1000.0;
        }
    }

    function handleMouseLeave() {
        
        mouseX = 1000.0;
        mouseY = 1000.0;
        
    }

    
    canvas.addEventListener('mousemove', updateMousePosition);
    canvas.addEventListener('mouseenter', updateMousePosition);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    
    canvas.addEventListener('touchstart', updateTouchPosition, { passive: false });
    canvas.addEventListener('touchmove', updateTouchPosition, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    const glContext = new GLContext(canvas, {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance"
    });

    
    function resizeCanvas() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        glContext.resize(width, height);
    }

    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const gl = glContext.getContext();
    glContext.setDepthTest(false);
    glContext.setClearColor(0.0, 0.0, 0.0, 1.0);

    
    const shaders = await loadShaders({
        vertex: './src/shaders/triangle.vert',
        fragment: './src/shaders/triangle.frag',
        computeVertex: './src/shaders/compute.vert',
        computeFragment: './src/shaders/compute.frag'
    });

    
    const renderProgram = new Program(gl, shaders.vertex, shaders.fragment);

    
    const computeProgram = new Program(gl, shaders.computeVertex, shaders.computeFragment, {
        transformFeedbackVaryings: ['v_newPosition', 'v_newVelocity', 'v_newColor']
    });

    const { positions, velocities, colors } = createParticleData(PARTICLE_COUNT);
    
    
    const buffer1 = createBuffer(gl, new Float32Array(PARTICLE_COUNT * 7), gl.DYNAMIC_DRAW); 
    const buffer2 = createBuffer(gl, new Float32Array(PARTICLE_COUNT * 7), gl.DYNAMIC_DRAW);
    
    
    const initialData = new Float32Array(PARTICLE_COUNT * 7);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        initialData[i * 7 + 0] = positions[i * 2 + 0];     
        initialData[i * 7 + 1] = positions[i * 2 + 1];     
        initialData[i * 7 + 2] = velocities[i * 2 + 0];    
        initialData[i * 7 + 3] = velocities[i * 2 + 1];    
        initialData[i * 7 + 4] = colors[i * 3 + 0];        
        initialData[i * 7 + 5] = colors[i * 3 + 1];        
        initialData[i * 7 + 6] = colors[i * 3 + 2];        
    }
    
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer1);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, initialData);

    
    const renderVAO1 = new VertexArray(gl);
    const renderVAO2 = new VertexArray(gl);
    const computeVAO1 = new VertexArray(gl);
    const computeVAO2 = new VertexArray(gl);
    
    function setupVAO(vao, buffer, program) {
        const stride = 7 * 4; 
        const posLoc = program.getAttributeLocation('a_position');
        const velLoc = program.getAttributeLocation('a_velocity');
        const colorLoc = program.getAttributeLocation('a_color');
        
        if (posLoc !== -1) {
            vao.addAttributeWithStride(posLoc, buffer, 2, stride, 0);
        }
        if (velLoc !== -1) {
            vao.addAttributeWithStride(velLoc, buffer, 2, stride, 8);
        }
        if (colorLoc !== -1) {
            vao.addAttributeWithStride(colorLoc, buffer, 3, stride, 16);
        }
    }

    setupVAO(renderVAO1, buffer1, renderProgram);
    setupVAO(renderVAO2, buffer2, renderProgram);
    setupVAO(computeVAO1, buffer1, computeProgram);
    setupVAO(computeVAO2, buffer2, computeProgram);

    
    const tf1 = createTransformFeedback(gl);
    const tf2 = createTransformFeedback(gl);

    
    
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf1);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffer1);
    
    
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf2);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffer2);
    
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

    let currentBuffer = 0; 

    let startTime = 0;
    let frameCount = 0;
    let lastFpsTime = 0;
    let lastTime = 0;

    function render(time) {
        if (!startTime) {
            startTime = time;
            lastTime = time;
        }
        if (!lastFpsTime) {
            lastFpsTime = time;
        }

        frameCount += 1;
        const timeSinceLastFps = time - lastFpsTime;
        if (timeSinceLastFps >= 1000) {
            const fps = (frameCount * 1000) / timeSinceLastFps;
            console.log(`FPS: ${fps.toFixed(1)}`);
            frameCount = 0;
            lastFpsTime = time;
        }

        const deltaTime = (time - lastTime) * 0.001;
        lastTime = time;

        
        computeProgram.use();
        computeProgram.setUniform('u_deltaTime', Math.min(deltaTime, 0.016)); 
        computeProgram.setUniform('u_time', (time - startTime) * 0.001); 
        
        
        if (mouseInitialized) {
            computeProgram.setUniform('u_mouse', [mouseX, mouseY]);
        } else {
            
            computeProgram.setUniform('u_mouse', [1000.0, 1000.0]);
        }

        
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

        
        glContext.clear();
        renderProgram.use();
        renderProgram.setUniform('u_pointSize', 1.5); 
        
        
        const renderVAO = currentBuffer === 0 ? renderVAO2 : renderVAO1;
        renderVAO.draw(gl.POINTS, PARTICLE_COUNT);

        
        currentBuffer = 1 - currentBuffer;

        if (simulationRunning) {
            animationId = requestAnimationFrame(render);
        }
    }

    simulationRunning = true;
    animationId = requestAnimationFrame(render);
}


function stopSimulation() {
    simulationRunning = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

function restartSimulation() {
    stopSimulation();
    start().catch(error => {
        console.error('Failed to restart simulation:', error);
    });
}


function formatParticleCount(count) {
    if (count >= 1000000) {
        return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
        return (count / 1000).toFixed(0) + 'K';
    }
    return count.toString();
}

function updateParticleCountDisplay() {
    const countElement = document.getElementById('particle-count');
    if (countElement) {
        countElement.textContent = formatParticleCount(PARTICLE_COUNT);
    }
}

function changeParticleCount(delta) {
    const minCount = 10000;   
    const maxCount = 2000000; 
    const increment = 50000;  
    
    PARTICLE_COUNT = Math.max(minCount, Math.min(maxCount, PARTICLE_COUNT + (delta * increment)));
    updateParticleCountDisplay();
    restartSimulation(); 
}

document.addEventListener('DOMContentLoaded', () => {
    
    const decreaseBtn = document.getElementById('decrease-particles');
    const increaseBtn = document.getElementById('increase-particles');
    
    if (decreaseBtn) {
        decreaseBtn.addEventListener('click', () => changeParticleCount(-1));
    }
    
    if (increaseBtn) {
        increaseBtn.addEventListener('click', () => changeParticleCount(1));
    }
    
    
    updateParticleCountDisplay();
    
    
    start().catch((error) => {
        console.error('Failed to start GPU particle demo:', error);
    });
});
