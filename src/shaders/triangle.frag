#version 300 es
precision highp float;

in vec3 v_color;
in vec2 v_position;
out vec4 fragColor;

void main() {
    float distFromCenter = length(v_position);
    float fadeStart = 1.6; // fade
    float fadeEnd = 2.0;
    
    float alpha = 1.0 - smoothstep(fadeStart, fadeEnd, distFromCenter);
    
    if (distFromCenter > fadeEnd) {
        discard;
    }
    
    fragColor = vec4(v_color, alpha);
}