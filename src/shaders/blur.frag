#version 300 es
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_direction; // (1.0, 0.0) for horizontal, (0.0, 1.0) for vertical
uniform float u_radius;
uniform vec2 u_textureSize;

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
    vec2 texelSize = 1.0 / u_textureSize;
    vec4 result = vec4(0.0);
    
    int kernelSize = int(ceil(u_radius * 2.0)) + 1;
    float s = u_radius / 3.0;
    float totalWeight = 0.0;
    
    for (int i = -kernelSize; i <= kernelSize; i++) {
        float offset = float(i);
        vec2 sampleCoord = v_texCoord + u_direction * texelSize * offset;
        
        float weight = exp(-(offset * offset) / (2.0 * s * s));
        
        vec4 texelSample = texture(u_texture, clamp(sampleCoord, 0.0, 1.0));
        
        result += texelSample * weight;
        totalWeight += weight;
    }
    
    fragColor = result / totalWeight;
}