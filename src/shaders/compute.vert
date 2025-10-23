#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_velocity;
in vec3 a_color;

uniform float u_deltaTime;
uniform vec2 u_mouse;
uniform float u_time;

out vec2 v_newPosition;
out vec2 v_newVelocity;
out vec3 v_newColor;

vec2 flowField(vec2 pos, float time) {
    float scale = 8.0;
    vec2 p = pos * scale + time * 0.3;
    
    float angle = sin(p.x) * cos(p.y) + sin(p.x * 1.3 + time) * 0.5;
    angle *= 3.14159;
    
    return vec2(cos(angle), sin(angle)) * 0.8;
}

void main() {
    vec2 position = a_position;
    vec2 velocity = a_velocity;
    vec3 color = a_color;

    vec2 flowForce = flowField(position, u_time) * 0.1;
    
    vec2 mouseForce = vec2(0.0);
    float mouseDistance = distance(position, u_mouse);
    if (mouseDistance > 0.01) {
        vec2 mouseDirection = normalize(u_mouse - position);
        float forceStrength = 1.0 / (mouseDistance * mouseDistance + 0.1);
        mouseForce = mouseDirection * forceStrength;
    }

    velocity += (flowForce + mouseForce) * u_deltaTime;
    velocity *= 0.99;
    position += velocity * u_deltaTime;

    if (position.x > 2.0){
        position.x = position.x - 4.0;
    } else if (position.x < -2.0){
        position.x = position.x + 4.0;
    }

    if (position.y > 2.0){
        position.y = position.y - 4.0;
    } else if (position.y < -2.0){
        position.y = position.y + 4.0;
    }

    float speed = length(velocity);
    color = mix(vec3(0.2, 0.2, 1.0), vec3(1.0, 0.2, 0.2), clamp(speed * 2.0, 0.0, 1.0));

    v_newPosition = position;
    v_newVelocity = velocity;
    v_newColor = color;

    gl_Position = vec4(0.0);
}