// Dynamic shader loading for development vs embedded for production
export async function loadShader(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load shader: ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        throw new Error(`Error loading shader from ${url}: ${error.message}`);
    }
}

export async function loadShaders(shaderPaths) {
    // In development, load from files
    if (import.meta.env.DEV) {
        const shaderPromises = Object.entries(shaderPaths).map(async ([name, path]) => {
            const source = await loadShader(path);
            return [name, source];
        });

        const shaderEntries = await Promise.all(shaderPromises);
        return Object.fromEntries(shaderEntries);
    }
    
    // In production, use embedded shaders via Vite's ?raw import
    return {
        vertex: await import('./triangle.vert?raw').then(m => m.default),
        fragment: await import('./triangle.frag?raw').then(m => m.default),
        computeVertex: await import('./compute.vert?raw').then(m => m.default),
        computeFragment: await import('./compute.frag?raw').then(m => m.default),
        blurVertex: await import('./blur.vert?raw').then(m => m.default),
        blurFragment: await import('./blur.frag?raw').then(m => m.default),
        blendFragment: await import('./blend.frag?raw').then(m => m.default),
        normalMapFragment: await import('./normalmap.frag?raw').then(m => m.default),
        edgeFragment: await import('./edge.frag?raw').then(m => m.default)
    };
}