import { GLContext, Program, VertexArray, Buffer } from './webgl/index.js';
import { loadShaders } from './shaders/loader.js';
import { TextPathGPU } from './textPath.js';

let PARTICLE_COUNT = 250000; 

var textSwitch = 1;
let loopEnabled = true; // Re-enabled simulation loop
let textEnabled = true;
let clockEnabled = false; // Clock is initially disabled

let simulationRunning = false;
let animationId = null;
let clockIntervalId = null; // Store clock interval ID

function createParticleData(particleCount) {
    const positions = new Float32Array(particleCount * 2);
    const velocities = new Float32Array(particleCount * 2);
    const types = new Float32Array(particleCount);

    // Helper function for gaussian random distribution (Box-Muller transform)
    function gaussianRandom(mean = 0, stdDev = 1) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return z0 * stdDev + mean;
    }

    for (let i = 0; i < particleCount; i++) {
        // Use gaussian distribution centered at (0, 0) with standard deviation of 0.5
        // This concentrates more particles in the middle while still spreading some out
        const x = gaussianRandom(0, 0.5);
        const y = gaussianRandom(0, 0.5);
        
        // Clamp to reasonable bounds to keep particles within view
        positions[i * 2]     = Math.max(-2.0, Math.min(2.0, x));
        positions[i * 2 + 1] = Math.max(-2.0, Math.min(2.0, y));

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

    let mouseX = 10.0; 
    let mouseY = 10.0; 
    let mouseInitialized = false;

    function updatePosition(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const aspectRatio = canvas.width / canvas.height;
        
        let mx = ((clientX - rect.left) / rect.width) * 2 - 1;
        let my = -(((clientY - rect.top) / rect.height) * 2 - 1);
        const scale = Math.min(1.0, 1.0 / aspectRatio);
        if (aspectRatio > 1.0) {
            mx /= scale;
        } else {
            my /= aspectRatio;
        }
        
        mouseX = mx;
        mouseY = my;
        
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
        const pixelRatio = window.devicePixelRatio || 1;
        
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        
        glContext.resize(width * pixelRatio, height * pixelRatio);
    }

    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

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

    // multi-level blur distance field
    const textPath = new TextPathGPU(gl, shaders, 'KARAN', {
        fontSize: 100,
        fontWeight: 'bold',
        textureSize: 512
    });
    
    const renderProgram = new Program(gl, shaders.vertex, shaders.fragment);

    
    const computeProgram = new Program(gl, shaders.computeVertex, shaders.computeFragment, {
        transformFeedbackVaryings: ['v_newPosition', 'v_newVelocity', 'v_newType']
    });

    let normalMapTexture = textPath.getNormalMapTexture();
    
    console.log(`GPU text distance field created: ${textPath.getTextureSize()}x${textPath.getTextureSize()}`);

    function updateTextPath(newText) {
        if (newText.trim() === '') return;
        
        textPath.updateText(newText.toUpperCase());
        normalMapTexture = textPath.getNormalMapTexture();
    }
    globalUpdateTextPath = updateTextPath;

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
    
    // openTextureInNewWindow(textPath.edgeTexture, 'Edge Detection');
    // openTextureInNewWindow(textPath.resultTexture, 'Distance Field');
    // openTextureInNewWindow(textPath.normalMapTexture, 'Normal Map');

    let currentBuffer = 0; 

    let startTime = 0;
    let frameCount = 0;
    let lastFpsTime = 0;
    let lastTime = 0;
    let names = ['WEBGL2', 'KARAN'];
    let index = 0;
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
        if (timeSinceLastFps >= 2000) {
            const fps = (frameCount * 1000) / timeSinceLastFps;
            console.log(`FPS: ${fps.toFixed(1)}`);
            frameCount = 0;
            lastFpsTime = time;
            
            if (loopEnabled) {
                globalUpdateTextPath(names[index]);
                index = (index + 1) % names.length;
            }
        }

        const deltaTime = (time - lastTime) * 0.001;
        lastTime = time;
        
        const aspectRatio = canvas.width / canvas.height;
        
        computeProgram.use();
        computeProgram.setUniform('u_deltaTime', Math.min(deltaTime, 0.016)); 
        computeProgram.setUniform('u_time', (time - startTime) * 0.001);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, normalMapTexture);
        computeProgram.setUniform('u_normalMap', 0);
        
        computeProgram.setUniform('u_textAttraction', textEnabled ? textSwitch : 0);
        
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

        gl.viewport(0, 0, canvas.width, canvas.height);
        
        glContext.clear();
        renderProgram.use();
        renderProgram.setUniform('u_pointSize', 1.5);
        
        renderProgram.setUniform('u_aspectRatio', aspectRatio);
        
        
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

function startClock() {
    if (clockIntervalId) {
        clearInterval(clockIntervalId);
    }
    if (clockEnabled) {
        clockIntervalId = setInterval(() => {
            let time = Date.now();
            let hours = new Date(time).getHours();
            let minutes = new Date(time).getMinutes();
            let seconds = new Date(time).getSeconds();
            let formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            if (globalUpdateTextPath) {
                globalUpdateTextPath(formattedTime);
            }
        }, 1000);
    }
}

function stopClock() {
    if (clockIntervalId) {
        clearInterval(clockIntervalId);
        clockIntervalId = null;
    }
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

let globalUpdateTextPath = null;

document.addEventListener('DOMContentLoaded', () => {
    
    const decreaseBtn = document.getElementById('decrease-particles');
    const increaseBtn = document.getElementById('increase-particles');
    const textInput = document.getElementById('text-input');
    const updateBtn = document.getElementById('update-text');
    const loopToggle = document.getElementById('loop-toggle');
    const textToggle = document.getElementById('text-toggle');
    const clockToggle = document.getElementById('clock-toggle');
    const menuToggle = document.getElementById('menu-toggle');
    const controlsContainer = document.getElementById('controls-container');
    
    let menuOpen = true;
    if (menuToggle && controlsContainer) {
        menuToggle.addEventListener('click', () => {
            menuOpen = !menuOpen;
            menuToggle.classList.toggle('active', menuOpen);
            controlsContainer.classList.toggle('hidden', !menuOpen);
        });
    }
    
    function updateButtonState() {
        if (updateBtn && textInput) {
            const text = textInput.value.trim();
            updateBtn.disabled = text.length < 3;
        }
    }
    
    updateButtonState();
    
    if (decreaseBtn) {
        decreaseBtn.addEventListener('click', () => changeParticleCount(-1));
    }
    
    if (increaseBtn) {
        increaseBtn.addEventListener('click', () => changeParticleCount(1));
    }
    
    if (textInput) {
        textInput.addEventListener('input', updateButtonState);
    }
    
    if (updateBtn && textInput) {
        updateBtn.addEventListener('click', () => {
            const newText = textInput.value.trim();
            if (newText && newText.length >= 3 && globalUpdateTextPath) {
                loopEnabled = false;
                if (loopToggle) {
                    loopToggle.checked = false;
                }

                if (!textEnabled) {
                    textEnabled = true;
                    if (textToggle) {
                        textToggle.checked = true;
                    }
                }
                clockEnabled = false;
                if (clockToggle) {
                    clockToggle.checked = false;
                }
                stopClock();
                globalUpdateTextPath(newText);
            }
        });
        
        textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const newText = textInput.value.trim();
                if (newText && newText.length >= 3 && globalUpdateTextPath) {
                    loopEnabled = false;
                    if (loopToggle) {
                        loopToggle.checked = false;
                    }
                    
                    clockEnabled = false;
                    if (clockToggle) {
                        clockToggle.checked = false;
                    }
                    stopClock();
                    globalUpdateTextPath(newText);
                }
            }
        });
    }
    
    if (loopToggle) {
        loopToggle.addEventListener('change', (e) => {
            loopEnabled = e.target.checked;
            if (loopEnabled) {
                if (!textEnabled) {
                    textEnabled = true;
                    if (textToggle) {
                        textToggle.checked = true;
                    }
                }
                
                clockEnabled = false;
                if (clockToggle) {
                    clockToggle.checked = false;
                }
                stopClock();
            }
        });
    }
    
    if (textToggle) {
        textToggle.addEventListener('change', (e) => {
            textEnabled = e.target.checked;
            if (!textEnabled) {
                loopEnabled = false;
                clockEnabled = false;
                if (loopToggle) {
                    loopToggle.checked = false;
                }
                if (clockToggle) {
                    clockToggle.checked = false;
                }
                stopClock();
            }
        });
    }
    
    if (clockToggle) {
        clockToggle.addEventListener('change', (e) => {
            clockEnabled = e.target.checked;
            if (clockEnabled) {
                
                
                if (!textEnabled) {
                    textEnabled = true;
                    if (textToggle) {
                        textToggle.checked = true;
                    }
                }
                
                loopEnabled = false;
                if (loopToggle) {
                    loopToggle.checked = false;
                }
                startClock();
            } else {
                stopClock();
            }
        });
    }
    
    updateParticleCountDisplay();
    
    start().catch((error) => {
        console.error('Failed to start GPU particle demo:', error);
    });
});
