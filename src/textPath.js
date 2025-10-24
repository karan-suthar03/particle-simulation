import { Program } from './webgl/Program.js';
import { VertexArray } from './webgl/VertexArray.js';
import { Texture } from './webgl/Texture.js';
import { Framebuffer } from './webgl/Framebuffer.js';
import { Buffer } from './webgl/Buffer.js';

export class TextPathGPU {
    constructor(gl, shaders, text, options = {}) {
        this.gl = gl;
        this.shaders = shaders;
        this.text = text;
        this.fontSize = options.fontSize || 100;
        this.fontFamily = options.fontFamily || 'Arial, sans-serif';
        this.fontWeight = options.fontWeight || 'bold';
        this.textureSize = options.textureSize || 256;
        
        this.blurProgram = new Program(gl, shaders.blurVertex, shaders.blurFragment);
        this.blendProgram = new Program(gl, shaders.blurVertex, shaders.blendFragment);
        this.normalMapProgram = new Program(gl, shaders.blurVertex, shaders.normalMapFragment);
        this.edgeProgram = new Program(gl, shaders.blurVertex, shaders.edgeFragment);
        
        this.setupFramebuffers();
        this.setupQuad();
        this.generateDistanceField();
    }

    setupFramebuffers() {
        const gl = this.gl;
        
        // Create textures for blur levels with progressively smaller sizes
        this.blurTextures = [];
        this.framebuffers = [];
        this.blurTextureSizes = [];
        
        for (let i = 0; i < 4; i++) {
            // Each level is half the size of the previous (mipmap style)
            const levelSize = Math.max(16, this.textureSize >> i); // Minimum 16px
            this.blurTextureSizes.push(levelSize);
            
            const texture = new Texture(gl, {
                width: levelSize,
                height: levelSize,
                internalFormat: gl.RGBA,
                format: gl.RGBA,
                type: gl.UNSIGNED_BYTE,
                minFilter: gl.LINEAR,
                magFilter: gl.LINEAR,
                wrapS: gl.CLAMP_TO_EDGE,
                wrapT: gl.CLAMP_TO_EDGE
            });
            
            const framebuffer = new Framebuffer(gl);
            framebuffer.attachTexture(texture, gl.COLOR_ATTACHMENT0);
            
            this.blurTextures.push(texture);
            this.framebuffers.push(framebuffer);
        }
        
        // Create final result texture
        this.resultTexture = new Texture(gl, {
            width: this.textureSize,
            height: this.textureSize,
            internalFormat: gl.RGBA,
            format: gl.RGBA,
            type: gl.UNSIGNED_BYTE,
            minFilter: gl.LINEAR,
            magFilter: gl.LINEAR,
            wrapS: gl.CLAMP_TO_EDGE,
            wrapT: gl.CLAMP_TO_EDGE
        });
        
        this.resultFramebuffer = new Framebuffer(gl);
        this.resultFramebuffer.attachTexture(this.resultTexture, gl.COLOR_ATTACHMENT0);
        
        // Create normal map texture (stores gradient + distance info)
        this.normalMapTexture = new Texture(gl, {
            width: this.textureSize,
            height: this.textureSize,
            internalFormat: gl.RGBA,
            format: gl.RGBA,
            type: gl.UNSIGNED_BYTE,
            minFilter: gl.LINEAR,
            magFilter: gl.LINEAR,
            wrapS: gl.CLAMP_TO_EDGE,
            wrapT: gl.CLAMP_TO_EDGE
        });
        
        this.normalMapFramebuffer = new Framebuffer(gl);
        this.normalMapFramebuffer.attachTexture(this.normalMapTexture, gl.COLOR_ATTACHMENT0);
        this.edgeTexture = new Texture(gl, {
            width: this.textureSize,
            height: this.textureSize,
            internalFormat: gl.RGBA,
            format: gl.RGBA,
            type: gl.UNSIGNED_BYTE,
            minFilter: gl.LINEAR,
            magFilter: gl.LINEAR,
            wrapS: gl.CLAMP_TO_EDGE,
            wrapT: gl.CLAMP_TO_EDGE
        });
        
        this.edgeFramebuffer = new Framebuffer(gl);
        this.edgeFramebuffer.attachTexture(this.edgeTexture, gl.COLOR_ATTACHMENT0);
    }

    setupQuad() {
        const gl = this.gl;
        
        // Create full-screen quad
        const vertices = new Float32Array([
            -1, -1, 0, 0,  // bottom-left
             1, -1, 1, 0,  // bottom-right
            -1,  1, 0, 1,  // top-left
             1,  1, 1, 1   // top-right
        ]);
        
        this.quadBuffer = new Buffer(gl, {
            data: vertices,
            usage: gl.STATIC_DRAW
        });
        
        // Use VertexArray class for better abstraction
        this.quadVAO = new VertexArray(gl);
        
        const posLoc = this.blurProgram.getAttributeLocation('a_position');
        const texLoc = this.blurProgram.getAttributeLocation('a_texCoord');
        
        if (posLoc !== -1) {
            this.quadVAO.addAttributeWithStride(posLoc, this.quadBuffer.getBuffer(), 2, 16, 0);
        }
        if (texLoc !== -1) {
            this.quadVAO.addAttributeWithStride(texLoc, this.quadBuffer.getBuffer(), 2, 16, 8);
        }
    }

    generateDistanceField() {
        const gl = this.gl;
        
        const originalViewport = gl.getParameter(gl.VIEWPORT);
        
        const baseTexture = this.createBaseTextTexture();
        
        this.applyEdgeDetection(baseTexture);
        
        this.applyBlurLevels(this.edgeTexture);
        
        this.blendLevels();
        
        this.generateNormalMap();
        
        gl.viewport(originalViewport[0], originalViewport[1], originalViewport[2], originalViewport[3]);
        
        baseTexture.delete();
    }

    createBaseTextTexture() {
        const gl = this.gl;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = this.textureSize;
        canvas.height = this.textureSize;
        
        const optimalSize = this.calculateOptimalFontSize(ctx, this.text);
        
        // Flip Y axis to match WebGL coordinate system
        ctx.scale(1, -1);
        ctx.translate(0, -canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.font = `${this.fontWeight} ${optimalSize}px ${this.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, canvas.width / 2, canvas.height / 2);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const textureData = new Uint8Array(canvas.width * canvas.height * 4);
        
        for (let i = 0; i < canvas.width * canvas.height; i++) {
            const alpha = imageData.data[i * 4 + 3];
            const value = alpha > 128 ? 255 : 0;
            textureData[i * 4] = value;     // R
            textureData[i * 4 + 1] = value; // G  
            textureData[i * 4 + 2] = value; // B
            textureData[i * 4 + 3] = 255;   // A
        }
        
        const texture = new Texture(gl, {
            width: canvas.width,
            height: canvas.height,
            internalFormat: gl.RGBA,
            format: gl.RGBA,
            type: gl.UNSIGNED_BYTE,
            data: textureData,
            minFilter: gl.LINEAR,
            magFilter: gl.LINEAR,
            wrapS: gl.CLAMP_TO_EDGE,
            wrapT: gl.CLAMP_TO_EDGE
        });
        
        return texture;
    }

    applyEdgeDetection(baseTexture) {
        const gl = this.gl;
        
        this.edgeFramebuffer.bind();
        gl.viewport(0, 0, this.textureSize, this.textureSize);
        
        this.edgeProgram.use();
        this.quadVAO.bind();
        gl.disable(gl.BLEND);
        
        baseTexture.activate(0);
        this.edgeProgram.setUniform('u_texture', 0);
        this.edgeProgram.setUniform('u_texelSize', [1.0 / this.textureSize, 1.0 / this.textureSize]);
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        this.quadVAO.unbind();
        gl.enable(gl.BLEND);
    }

    applyBlurLevels(baseTexture) {
        const gl = this.gl;
        const blurRadii = [2, 4, 8, 16]; // Adjusted radii for smaller textures
        
        let sourceTexture = baseTexture;
        
        for (let i = 0; i < blurRadii.length; i++) {
            const levelSize = this.blurTextureSizes[i];
            gl.viewport(0, 0, levelSize, levelSize);
            
            this.applyGaussianBlur(sourceTexture, this.blurTextures[i], blurRadii[i], levelSize);
            
            // Use this level as input for the next level (cascading downsampling)
            sourceTexture = this.blurTextures[i];
        }
    }

    applyGaussianBlur(sourceTexture, targetTexture, radius, levelSize) {
        const gl = this.gl;
        
        const tempTexture = new Texture(gl, {
            width: levelSize,
            height: levelSize,
            internalFormat: gl.RGBA,
            format: gl.RGBA,
            type: gl.UNSIGNED_BYTE,
            minFilter: gl.LINEAR,
            magFilter: gl.LINEAR
        });
        
        const tempFramebuffer = new Framebuffer(gl);
        tempFramebuffer.attachTexture(tempTexture, gl.COLOR_ATTACHMENT0);
        
        this.blurProgram.use();
        this.quadVAO.bind();
        gl.disable(gl.BLEND);
        
        // Horizontal pass
        tempFramebuffer.bind();
        sourceTexture.activate(0);
        this.blurProgram.setUniform('u_texture', 0);
        this.blurProgram.setUniform('u_direction', [1.0, 0.0]);
        this.blurProgram.setUniform('u_radius', radius);
        this.blurProgram.setUniform('u_textureSize', [levelSize, levelSize]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Vertical pass
        const targetFramebuffer = this.framebuffers[this.blurTextures.indexOf(targetTexture)];
        targetFramebuffer.bind();
        tempTexture.activate(0);
        this.blurProgram.setUniform('u_direction', [0.0, 1.0]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        tempTexture.delete();
        tempFramebuffer.delete();
        this.quadVAO.unbind();
        
        gl.enable(gl.BLEND);
    }

    blendLevels() {
        const gl = this.gl;
        
        this.resultFramebuffer.bind();
        gl.viewport(0, 0, this.textureSize, this.textureSize);
        
        this.blendProgram.use();
        this.quadVAO.bind();
        gl.disable(gl.BLEND);
        
        for (let i = 0; i < 4; i++) {
            this.blurTextures[i].activate(i);
            this.blendProgram.setUniform(`u_level${i + 1}`, i);
        }
        
        this.blendProgram.setUniform('u_weights', [0.355, 0.75, 1.5, 3]);
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        this.quadVAO.unbind();
        this.resultFramebuffer.unbind();
        
        gl.enable(gl.BLEND);
    }

    generateNormalMap() {
        const gl = this.gl;
        
        this.normalMapFramebuffer.bind();
        gl.viewport(0, 0, this.textureSize, this.textureSize);
        
        this.normalMapProgram.use();
        this.quadVAO.bind();
        gl.disable(gl.BLEND);
        
        this.resultTexture.activate(0);
        this.normalMapProgram.setUniform('u_distanceField', 0);
        this.normalMapProgram.setUniform('u_textureSize', [this.textureSize, this.textureSize]);
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        this.quadVAO.unbind();
        this.normalMapFramebuffer.unbind();
        gl.enable(gl.BLEND);
    }

    getDistanceFieldTexture() {
        return this.resultTexture.getTexture();
    }

    getNormalMapTexture() {
        return this.normalMapTexture.getTexture();
    }

    getEdgeTexture() {
        return this.edgeTexture.getTexture();
    }

    getTextureSize() {
        return this.textureSize;
    }

    updateText(newText) {
        this.text = newText;
        this.generateDistanceField();
    }

    calculateOptimalFontSize(ctx, text) {
        const padding = 30;
        const maxWidth = this.textureSize - padding * 2;
        const maxHeight = this.textureSize - padding * 2;
        
        let minSize = 10;
        let maxSize = this.textureSize;
        let fontSize = minSize;
        
        const getTextDimensions = (size) => {
            ctx.font = `${this.fontWeight} ${size}px ${this.fontFamily}`;
            const metrics = ctx.measureText(text);
            
            let width = metrics.width;
            let height = size;
            
            if (metrics.actualBoundingBoxLeft !== undefined) {
                width = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
                height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
            }
            
            return { width, height };
        };
        
        for (let i = 0; i < 30; i++) {
            fontSize = (minSize + maxSize) / 2;
            const { width, height } = getTextDimensions(fontSize);
            
            const fitsWidth = width <= maxWidth * 0.98;
            const fitsHeight = height <= maxHeight * 0.98;
            
            if (fitsWidth && fitsHeight) {
                minSize = fontSize;
            } else {
                maxSize = fontSize;
            }
            
            if (maxSize - minSize < 0.5) {
                break;
            }
        }
        
        fontSize = minSize;
        
        let { width, height } = getTextDimensions(fontSize);
        
        while ((width > maxWidth || height > maxHeight) && fontSize > 10) {
            fontSize -= 0.5;
            const dims = getTextDimensions(fontSize);
            width = dims.width;
            height = dims.height;
        }
        
        fontSize = Math.max(fontSize, 10);
        return fontSize;
    }

    cleanup() {
        const gl = this.gl;
        
        this.blurTextures.forEach(texture => texture.delete());
        this.resultTexture.delete();
        this.normalMapTexture.delete();
        this.edgeTexture.delete();
        
        this.framebuffers.forEach(fb => fb.delete());
        this.resultFramebuffer.delete();
        this.normalMapFramebuffer.delete();
        this.edgeFramebuffer.delete();
        
        this.quadBuffer.delete();
        this.quadVAO.delete();
    }

}