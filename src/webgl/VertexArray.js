export class VertexArray {
    constructor(gl) {
        this.gl = gl;
        this.vao = gl.createVertexArray();
        this.attributes = [];

        if (!this.vao) {
            throw new Error('Failed to create vertex array object');
        }
    }

    bind() {
        this.gl.bindVertexArray(this.vao);
    }

    unbind() {
        this.gl.bindVertexArray(null);
    }

    addAttribute(index, buffer, size, type = null, normalized = false, stride = 0, offset = 0) {
        const gl = this.gl;
        
        if (type === null) {
            type = gl.FLOAT;
        }

        this.bind();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        
        gl.enableVertexAttribArray(index);
        gl.vertexAttribPointer(index, size, type, normalized, stride, offset);
        
        this.attributes.push({
            index,
            buffer,
            size,
            type,
            normalized,
            stride,
            offset
        });

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        this.unbind();
    }

    setIndexBuffer(indexBuffer) {
        this.bind();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        this.indexBuffer = indexBuffer;
        this.unbind();
    }

    addAttributeWithStride(index, buffer, size, stride, offset, type = null, normalized = false) {
        const gl = this.gl;
        
        if (type === null) {
            type = gl.FLOAT;
        }

        this.bind();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        
        gl.enableVertexAttribArray(index);
        gl.vertexAttribPointer(index, size, type, normalized, stride, offset);
        
        this.attributes.push({
            index,
            buffer,
            size,
            type,
            normalized,
            stride,
            offset
        });

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        this.unbind();
    }

    draw(mode, count, offset = 0) {
        const gl = this.gl;
        this.bind();
        
        if (this.indexBuffer) {
            gl.drawElements(mode, count, gl.UNSIGNED_SHORT, offset);
        } else {
            gl.drawArrays(mode, offset, count);
        }
        
        this.unbind();
    }

    drawInstanced(mode, count, instanceCount, offset = 0) {
        const gl = this.gl;
        this.bind();
        
        if (this.indexBuffer) {
            gl.drawElementsInstanced(mode, count, gl.UNSIGNED_SHORT, offset, instanceCount);
        } else {
            gl.drawArraysInstanced(mode, offset, count, instanceCount);
        }
        
        this.unbind();
    }

    delete() {
        if (this.vao) {
            this.gl.deleteVertexArray(this.vao);
            this.vao = null;
        }
    }

    getVAO() {
        return this.vao;
    }
}
