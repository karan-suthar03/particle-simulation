#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_velocity;
in float a_type;

uniform float u_pointSize;
uniform float u_aspectRatio;

out vec3 v_color;
out vec2 v_position;

void main() {
    vec2 correctedPosition = a_position;
    
    float scale = min(1.0, 1.0 / u_aspectRatio);
    if (u_aspectRatio > 1.0) {
        correctedPosition.x *= scale;
    } else {
        correctedPosition.y *= u_aspectRatio;
    }
    
    gl_Position = vec4(correctedPosition, 0.0, 1.0);
    gl_PointSize = u_pointSize;
    
    // Pass original position for fade-out calculation
    v_position = a_position;
    
    if (a_type < 1.0) {
        v_color = vec3(1.0, 0.2, 0.2); // Red for type 0
    } else if (a_type < 2.0) {
        v_color = vec3(0.2, 1.0, 0.2); // Green for type 1
    } else if (a_type < 3.0) {
        v_color = vec3(0.2, 0.2, 1.0); // Blue for type 2
    } else if (a_type < 4.0) {
        v_color = vec3(1.0, 1.0, 0.2); // Yellow for type 3
    } else if (a_type < 5.0) {
        v_color = vec3(1.0, 0.2, 1.0); // Magenta for type 4
    } else if (a_type < 6.0) {
        v_color = vec3(0.2, 1.0, 1.0); // Cyan for type 5
    } else if (a_type < 7.0) {
        v_color = vec3(1.0, 0.5, 0.2); // Orange for type 6
    } else if (a_type < 8.0) {
        v_color = vec3(0.5, 0.2, 1.0); // Purple for type 7
    } else if (a_type < 9.0) {
        v_color = vec3(0.2, 0.5, 1.0); // Light Blue for type 8
    } else {
        v_color = vec3(0.5, 1.0, 0.2); // Lime for type 9
    }
}