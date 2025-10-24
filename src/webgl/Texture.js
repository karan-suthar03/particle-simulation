export class Texture {
    constructor(gl, options = {}) {
        this.gl = gl;
        this.texture = gl.createTexture();
        this.target = options.target || gl.TEXTURE_2D;
        this.width = options.width || 0;
        this.height = options.height || 0;
        
        if (!this.texture) {
            throw new Error('Failed to create texture');
        }
        
        this.bind();
        
        
        this.setParameter(gl.TEXTURE_MIN_FILTER, options.minFilter || gl.LINEAR);
        this.setParameter(gl.TEXTURE_MAG_FILTER, options.magFilter || gl.LINEAR);
        this.setParameter(gl.TEXTURE_WRAP_S, options.wrapS || gl.CLAMP_TO_EDGE);
        this.setParameter(gl.TEXTURE_WRAP_T, options.wrapT || gl.CLAMP_TO_EDGE);
        
        
        if (options.width && options.height) {
            this.allocate(
                options.width,
                options.height,
                options.internalFormat || gl.RGBA,
                options.format || gl.RGBA,
                options.type || gl.UNSIGNED_BYTE,
                options.data || null
            );
        }
        
        this.unbind();
    }
    
    bind() {
        this.gl.bindTexture(this.target, this.texture);
    }
    
    unbind() {
        this.gl.bindTexture(this.target, null);
    }
    
    setParameter(pname, param) {
        this.gl.texParameteri(this.target, pname, param);
    }
    
    allocate(width, height, internalFormat, format, type, data = null) {
        this.width = width;
        this.height = height;
        this.bind();
        this.gl.texImage2D(
            this.target,
            0,
            internalFormat,
            width,
            height,
            0,
            format,
            type,
            data
        );
        this.unbind();
    }
    
    update(width, height, format, type, data) {
        this.bind();
        this.gl.texImage2D(
            this.target,
            0,
            format,
            width,
            height,
            0,
            format,
            type,
            data
        );
        this.unbind();
    }
    
    updateSubImage(xoffset, yoffset, width, height, format, type, data) {
        this.bind();
        this.gl.texSubImage2D(
            this.target,
            xoffset,
            yoffset,
            width,
            height,
            format,
            type,
            data
        );
        this.unbind();
    }
    
    activate(unit = 0) {
        this.gl.activeTexture(this.gl.TEXTURE0 + unit);
        this.bind();
    }
    
    delete() {
        if (this.texture) {
            this.gl.deleteTexture(this.texture);
            this.texture = null;
        }
    }
    
    getTexture() {
        return this.texture;
    }
    
    getWidth() {
        return this.width;
    }
    
    getHeight() {
        return this.height;
    }
}
