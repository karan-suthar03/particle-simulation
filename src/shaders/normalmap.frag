#version 300 es
precision highp float;

uniform sampler2D u_distanceField;
uniform vec2 u_textureSize;

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
    vec2 texelSize = 1.0 / u_textureSize;
    
    float center = texture(u_distanceField, v_texCoord).r;
    float right = texture(u_distanceField, v_texCoord + vec2(texelSize.x, 0.0)).r;
    float left = texture(u_distanceField, v_texCoord - vec2(texelSize.x, 0.0)).r;
    float up = texture(u_distanceField, v_texCoord + vec2(0.0, texelSize.y)).r;
    float down = texture(u_distanceField, v_texCoord - vec2(0.0, texelSize.y)).r;
    
    // Calculate gradient (points toward higher values - toward text)
    vec2 gradient = vec2(
        right - left,
        up - down
    );
    
    // Store gradient direction in RG channels, magnitude in B, distance in A
    float gradientLength = length(gradient);
    
    gradient = gradient / gradientLength;
    
    vec2 packedGradient = gradient * 0.5 + 0.5;
    
    fragColor = vec4(
        packedGradient.x,
        packedGradient.y,
        gradientLength,
        center
    );
}