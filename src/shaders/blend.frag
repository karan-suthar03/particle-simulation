#version 300 es
precision highp float;

uniform sampler2D u_level1;
uniform sampler2D u_level2;
uniform sampler2D u_level3;
uniform sampler2D u_level4;

uniform vec4 u_weights;

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
    float level1 = texture(u_level1, v_texCoord).r;
    float level2 = texture(u_level2, v_texCoord).r;
    float level3 = texture(u_level3, v_texCoord).r;
    float level4 = texture(u_level4, v_texCoord).r;
    
    float result = level1 * u_weights.x + 
                   level2 * u_weights.y + 
                   level3 * u_weights.z + 
                   level4 * u_weights.w;
    
    fragColor = vec4(result, 0.0, 0.0, 1.0);
}