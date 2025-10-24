export class Framebuffer {
    constructor(gl) {
        this.gl = gl;
        this.framebuffer = gl.createFramebuffer();
        this.attachments = {
            color: [],
            depth: null,
            stencil: null
        };
        
        if (!this.framebuffer) {
            throw new Error('Failed to create framebuffer');
        }
    }
    
    bind() {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    }
    
    unbind() {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
    
    attachTexture(texture, attachment = null) {
        const gl = this.gl;
        
        if (attachment === null) {
            attachment = gl.COLOR_ATTACHMENT0;
        }
        
        this.bind();
        
        const webglTexture = texture.getTexture ? texture.getTexture() : texture;
        
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            attachment,
            gl.TEXTURE_2D,
            webglTexture,
            0
        );
        
        if (attachment >= gl.COLOR_ATTACHMENT0 && attachment <= gl.COLOR_ATTACHMENT15) {
            const index = attachment - gl.COLOR_ATTACHMENT0;
            this.attachments.color[index] = texture;
        } else if (attachment === gl.DEPTH_ATTACHMENT) {
            this.attachments.depth = texture;
        } else if (attachment === gl.STENCIL_ATTACHMENT) {
            this.attachments.stencil = texture;
        }
        
        this.unbind();
        return this;
    }
    
    attachRenderbuffer(renderbuffer, attachment) {
        this.bind();
        this.gl.framebufferRenderbuffer(
            this.gl.FRAMEBUFFER,
            attachment,
            this.gl.RENDERBUFFER,
            renderbuffer
        );
        this.unbind();
        return this;
    }
    
    checkStatus() {
        const gl = this.gl;
        this.bind();
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        this.unbind();
        
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            const statusMap = {
                [gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]: 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT',
                [gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT]: 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT',
                [gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS]: 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS',
                [gl.FRAMEBUFFER_UNSUPPORTED]: 'FRAMEBUFFER_UNSUPPORTED',
                [gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE]: 'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE'
            };
            
            throw new Error(`Framebuffer incomplete: ${statusMap[status] || 'UNKNOWN_ERROR'}`);
        }
        
        return true;
    }
    
    delete() {
        if (this.framebuffer) {
            this.gl.deleteFramebuffer(this.framebuffer);
            this.framebuffer = null;
        }
    }
    
    getFramebuffer() {
        return this.framebuffer;
    }
    
    getAttachment(type = 'color', index = 0) {
        if (type === 'color') {
            return this.attachments.color[index];
        } else if (type === 'depth') {
            return this.attachments.depth;
        } else if (type === 'stencil') {
            return this.attachments.stencil;
        }
        return null;
    }
}
