export class GLContext {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', {
            alpha: options.alpha !== undefined ? options.alpha : true,
            antialias: options.antialias !== undefined ? options.antialias : true,
            depth: options.depth !== undefined ? options.depth : true,
            preserveDrawingBuffer: options.preserveDrawingBuffer || false,
            powerPreference: options.powerPreference || 'default'
        });

        if (!this.gl) {
            throw new Error('WebGL2 is not supported in this browser');
        }

        this.initializeDefaults();
    }

    initializeDefaults() {
        const gl = this.gl;
        
        
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        
        
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        
        
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    clear(mask = null) {
        const gl = this.gl;
        if (mask === null) {
            mask = gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT;
        }
        gl.clear(mask);
    }

    setViewport(x, y, width, height) {
        this.gl.viewport(x, y, width, height);
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.setViewport(0, 0, width, height);
    }

    setClearColor(r, g, b, a = 1.0) {
        this.gl.clearColor(r, g, b, a);
    }

    setDepthTest(enabled) {
        if (enabled) {
            this.gl.enable(this.gl.DEPTH_TEST);
        } else {
            this.gl.disable(this.gl.DEPTH_TEST);
        }
    }

    setBlending(enabled) {
        if (enabled) {
            this.gl.enable(this.gl.BLEND);
        } else {
            this.gl.disable(this.gl.BLEND);
        }
    }

    setBlendFunc(src, dst) {
        this.gl.blendFunc(src, dst);
    }

    getContext() {
        return this.gl;
    }

    getCanvas() {
        return this.canvas;
    }
}
