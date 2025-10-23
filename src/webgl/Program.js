import { Shader } from './Shader.js';

export class Program {
    constructor(gl, vertexSource, fragmentSource, options = {}) {
        this.gl = gl;
        this.program = null;
        this.uniforms = {};
        this.attributes = {};
        this.transformFeedbackVaryings = options.transformFeedbackVaryings || null;
        
        this.vertexShader = Shader.createVertexShader(gl, vertexSource);
        this.fragmentShader = Shader.createFragmentShader(gl, fragmentSource);
        
        this.link();
        this.introspect();
    }

    link() {
        const gl = this.gl;
        this.program = gl.createProgram();
        
        if (!this.program) {
            throw new Error('Failed to create program');
        }

        gl.attachShader(this.program, this.vertexShader.getShader());
        gl.attachShader(this.program, this.fragmentShader.getShader());
        
        if (this.transformFeedbackVaryings && this.transformFeedbackVaryings.length > 0) {
            gl.transformFeedbackVaryings(this.program, this.transformFeedbackVaryings, gl.INTERLEAVED_ATTRIBS);
        }
        
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(this.program);
            this.delete();
            throw new Error(`Program linking failed: ${info}`);
        }

        this.vertexShader.delete();
        this.fragmentShader.delete();
    }

    introspect() {
        const gl = this.gl;
        
        const numUniforms = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < numUniforms; i++) {
            const info = gl.getActiveUniform(this.program, i);
            const location = gl.getUniformLocation(this.program, info.name);
            this.uniforms[info.name] = {
                location,
                type: info.type,
                size: info.size
            };
        }

        const numAttributes = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < numAttributes; i++) {
            const info = gl.getActiveAttrib(this.program, i);
            const location = gl.getAttribLocation(this.program, info.name);
            this.attributes[info.name] = {
                location,
                type: info.type,
                size: info.size
            };
        }
    }

    use() {
        this.gl.useProgram(this.program);
    }

    getUniformLocation(name) {
        return this.uniforms[name]?.location || null;
    }

    getAttributeLocation(name) {
        return this.attributes[name]?.location ?? -1;
    }

    setUniform(name, value) {
        const uniform = this.uniforms[name];
        if (!uniform) {
            console.warn(`Uniform '${name}' not found in program`);
            return;
        }

        const gl = this.gl;
        const loc = uniform.location;

        switch (uniform.type) {
            case gl.FLOAT:
                gl.uniform1f(loc, value);
                break;
            case gl.FLOAT_VEC2:
                gl.uniform2fv(loc, value);
                break;
            case gl.FLOAT_VEC3:
                gl.uniform3fv(loc, value);
                break;
            case gl.FLOAT_VEC4:
                gl.uniform4fv(loc, value);
                break;
            case gl.INT:
            case gl.BOOL:
            case gl.SAMPLER_2D:
            case gl.SAMPLER_CUBE:
                gl.uniform1i(loc, value);
                break;
            case gl.INT_VEC2:
            case gl.BOOL_VEC2:
                gl.uniform2iv(loc, value);
                break;
            case gl.INT_VEC3:
            case gl.BOOL_VEC3:
                gl.uniform3iv(loc, value);
                break;
            case gl.INT_VEC4:
            case gl.BOOL_VEC4:
                gl.uniform4iv(loc, value);
                break;
            case gl.FLOAT_MAT2:
                gl.uniformMatrix2fv(loc, false, value);
                break;
            case gl.FLOAT_MAT3:
                gl.uniformMatrix3fv(loc, false, value);
                break;
            case gl.FLOAT_MAT4:
                gl.uniformMatrix4fv(loc, false, value);
                break;
            default:
                console.warn(`Unknown uniform type: ${uniform.type}`);
        }
    }

    setUniforms(uniforms) {
        for (const [name, value] of Object.entries(uniforms)) {
            this.setUniform(name, value);
        }
    }

    delete() {
        if (this.program) {
            this.gl.deleteProgram(this.program);
            this.program = null;
        }
        this.vertexShader?.delete();
        this.fragmentShader?.delete();
    }

    getProgram() {
        return this.program;
    }
}
