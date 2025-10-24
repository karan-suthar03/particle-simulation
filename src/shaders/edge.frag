#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform vec2 u_texelSize;

// Sobel edge detection
void main() {
    // Sample 3x3 neighborhood
    float tl = texture(u_texture, v_texCoord + vec2(-u_texelSize.x,  u_texelSize.y)).r;
    float t  = texture(u_texture, v_texCoord + vec2(0.0,             u_texelSize.y)).r;
    float tr = texture(u_texture, v_texCoord + vec2( u_texelSize.x,  u_texelSize.y)).r;
    
    float l  = texture(u_texture, v_texCoord + vec2(-u_texelSize.x,  0.0)).r;
    float c  = texture(u_texture, v_texCoord).r;
    float r  = texture(u_texture, v_texCoord + vec2( u_texelSize.x,  0.0)).r;
    
    float bl = texture(u_texture, v_texCoord + vec2(-u_texelSize.x, -u_texelSize.y)).r;
    float b  = texture(u_texture, v_texCoord + vec2(0.0,            -u_texelSize.y)).r;
    float br = texture(u_texture, v_texCoord + vec2( u_texelSize.x, -u_texelSize.y)).r;
    
    // Sobel operator
    float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
    float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
    
    // Edge magnitude
    float edge = sqrt(gx*gx + gy*gy);
    
    // Normalize and output
    edge = clamp(edge, 0.0, 1.0);
    
    fragColor = vec4(edge, edge, edge, 1.0);
}
