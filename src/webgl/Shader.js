export class Shader {
    constructor(gl, type, source) {
        this.gl = gl;
        this.type = type;
        this.source = source;
        this.shader = null;
        
        this.compile();
    }

    compile() {
        const gl = this.gl;
        this.shader = gl.createShader(this.type);
        
        if (!this.shader) {
            throw new Error('Failed to create shader');
        }

        gl.shaderSource(this.shader, this.source);
        gl.compileShader(this.shader);

        
        if (!gl.getShaderParameter(this.shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(this.shader);
            gl.deleteShader(this.shader);
            throw new Error(`Shader compilation failed: ${info}`);
        }
    }


    getShader() {
        return this.shader;
    }

    delete() {
        if (this.shader) {
            this.gl.deleteShader(this.shader);
            this.shader = null;
        }
    }

    static createVertexShader(gl, source) {
        return new Shader(gl, gl.VERTEX_SHADER, source);
    }

    static createFragmentShader(gl, source) {
        return new Shader(gl, gl.FRAGMENT_SHADER, source);
    }
}
