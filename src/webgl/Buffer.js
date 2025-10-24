export class Buffer {
    constructor(gl, options = {}) {
        this.gl = gl;
        this.buffer = gl.createBuffer();
        this.target = options.target || gl.ARRAY_BUFFER;
        this.usage = options.usage || gl.STATIC_DRAW;
        this.size = 0;
        
        if (!this.buffer) {
            throw new Error('Failed to create buffer');
        }
        
        if (options.data) {
            this.setData(options.data, options.usage);
        } else if (options.size) {
            this.allocate(options.size, options.usage);
        }
    }
    
    bind() {
        this.gl.bindBuffer(this.target, this.buffer);
    }
    
    unbind() {
        this.gl.bindBuffer(this.target, null);
    }
    
    setData(data, usage = null) {
        if (usage !== null) {
            this.usage = usage;
        }
        
        this.bind();
        this.gl.bufferData(this.target, data, this.usage);
        this.size = data.byteLength;
        this.unbind();
    }
    
    allocate(size, usage = null) {
        if (usage !== null) {
            this.usage = usage;
        }
        
        this.bind();
        this.gl.bufferData(this.target, size, this.usage);
        this.size = size;
        this.unbind();
    }
    
    updateData(data, offset = 0) {
        this.bind();
        this.gl.bufferSubData(this.target, offset, data);
        this.unbind();
    }
    
    bindBase(index) {
        const target = this.gl.TRANSFORM_FEEDBACK_BUFFER;
        this.gl.bindBufferBase(target, index, this.buffer);
    }
    
    bindRange(index, offset, size) {
        const target = this.gl.TRANSFORM_FEEDBACK_BUFFER;
        this.gl.bindBufferRange(target, index, this.buffer, offset, size);
    }
    
    delete() {
        if (this.buffer) {
            this.gl.deleteBuffer(this.buffer);
            this.buffer = null;
        }
    }
    
    getBuffer() {
        return this.buffer;
    }
    
    getSize() {
        return this.size;
    }
    
    getTarget() {
        return this.target;
    }
    
    getUsage() {
        return this.usage;
    }
}
