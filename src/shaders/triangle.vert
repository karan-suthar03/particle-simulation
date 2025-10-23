#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_velocity;
in vec3 a_color;

uniform float u_pointSize;

out vec3 v_color;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    gl_PointSize = u_pointSize;
    v_color = a_color;
}