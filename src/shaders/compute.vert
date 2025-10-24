#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_velocity;
in float a_type;

uniform float u_deltaTime;
uniform float u_time;

uniform sampler2D u_normalMap;
uniform float u_textAttraction;

out vec2 v_newPosition;
out vec2 v_newVelocity;
out float v_newType;

vec2 rotate(vec2 v, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(
        v.x * c - v.y * s,
        v.x * s + v.y * c
    );
}

vec3 hash3(vec2 p) {
    vec3 q = vec3(dot(p, vec2(127.1, 311.7)),
                  dot(p, vec2(269.5, 183.3)),
                  dot(p, vec2(419.2, 371.9)));
    return fract(sin(q) * 43758.5453);
}

vec4 sampleNormalMap(vec2 position) {
    vec2 texCoord = (position + 1.0) * 0.5;

    return texture(u_normalMap, texCoord);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    
    vec2 ga = hash3(i + vec2(0.0, 0.0)).xy * 2.0 - 1.0;
    vec2 gb = hash3(i + vec2(1.0, 0.0)).xy * 2.0 - 1.0;
    vec2 gc = hash3(i + vec2(0.0, 1.0)).xy * 2.0 - 1.0;
    vec2 gd = hash3(i + vec2(1.0, 1.0)).xy * 2.0 - 1.0;
    
    float va = dot(ga, f - vec2(0.0, 0.0));
    float vb = dot(gb, f - vec2(1.0, 0.0));
    float vc = dot(gc, f - vec2(0.0, 1.0));
    float vd = dot(gd, f - vec2(1.0, 1.0));
    
    return mix(mix(va, vb, u.x), mix(vc, vd, u.x), u.y) * 0.5 + 0.5;
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 0.0;
    
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
        p = vec2(p.y - p.x, p.x + p.y) * 0.5;
    }
    
    return value;
}

vec2 capVelocity(vec2 v, float maxSpeed) {
    float speed = length(v) + 1e-8;
    float scale = clamp(maxSpeed / speed, 0.0, 1.0);
    return v * scale;
}


void main() {
    vec2 position = a_position;
    vec2 velocity = a_velocity;

    vec2 acceleration = vec2(0.0);
    float drag = 0.0015;

    if (u_textAttraction > 0.0) {
        vec4 normalData = sampleNormalMap(position);
        
        // Unpack data: RG = gradient, B = magnitude, A = distance
        vec2 packedGradient = normalData.rg;
        float gradientMagnitude = normalData.b;
        float distanceFieldValue = normalData.a;
        
        if (gradientMagnitude > 0.001) {
            vec2 gradientDirection = packedGradient * 2.0 - 1.0;

            gradientDirection = rotate(gradientDirection, 0.5);
            
            float baseStrength = distanceFieldValue * u_textAttraction;
            
            float gradientStrength = gradientMagnitude * 10.0;
            
            float finalStrength = baseStrength  * (1.0 + gradientStrength);
            
            acceleration += gradientDirection * finalStrength * 8.0;
            
            vec2 randomOffset = vec2(
                hash3(position + vec2(u_time * 0.1, 0)).x - 0.5,
                hash3(position + vec2(0, u_time * 0.1 + 100.0)).y - 0.5
            ) * 0.1 * distanceFieldValue;
            
            acceleration += randomOffset;
        }
    }

    float noiseInfluence = 1.0 - u_textAttraction * 0.5;
    float noiseScale = 1.5 + (3.0 - a_type) * 0.3;
    float noiseStrength = ((3.0 - a_type) * 2.0) * noiseInfluence;
    float timeOffset = u_time * 0.3;
    
    // vec2 noiseForce = vec2(
    //     fbm(position * noiseScale + vec2(timeOffset, a_type * 100.0)) - 0.5,
    //     fbm(position * noiseScale + vec2(a_type * 100.0, timeOffset + 100.0)) - 0.5
    // ) * noiseStrength;
    
    // acceleration += noiseForce;

    velocity += acceleration * u_deltaTime;
    
    vec2 randomVel = vec2(
        hash3(position + vec2(u_deltaTime, a_type)).x - 0.5,
        hash3(position + vec2(a_type, u_deltaTime + 1.0)).y - 0.5
    ) * 0.001;
    velocity += randomVel;
    
    velocity *= (1.0 - drag);

    velocity = capVelocity(velocity, (0.1 * (a_type))+0.9);
    
    vec2 newPosition = position + velocity * u_deltaTime;

    v_newPosition = newPosition;
    v_newVelocity = velocity;
    v_newType = a_type;

    gl_Position = vec4(0.0);
}