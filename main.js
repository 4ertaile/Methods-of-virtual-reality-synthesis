'use strict';

let gl;                         
let surface;                    
let shProgram;                  
let spaceball;                  
const { cos, sin, sqrt, pow, tan, PI } = Math
let stereoCamera;
let converg = 5, eyeSep = 0.8, foView = 30, ncDist = 1;

function deg2rad(angle) {
    return angle * PI / 180;
}

function StereoCamera(
    Convergence,
    EyeSeparation,
    AspectRatio,
    FOV,
    NearClippingDistance,
    FarClippingDistance
) {
    this.mConvergence = Convergence;
    this.mEyeSeparation = EyeSeparation;
    this.mAspectRatio = AspectRatio;
    this.mFOV = deg2rad(FOV);
    this.mNearClippingDistance = NearClippingDistance;
    this.mFarClippingDistance = FarClippingDistance;

    this.ApplyLeftFrustum = function () {
        let top, bottom, leftF, rightF;
        top = this.mNearClippingDistance * tan(this.mFOV / 2);
        bottom = -top;
        const AL = this.mAspectRatio * tan(this.mFOV / 2) * this.mConvergence;

        const b = AL - this.mEyeSeparation / 2;
        const c = AL + this.mEyeSeparation / 2;

        leftF = -b * this.mNearClippingDistance / this.mConvergence;
        rightF = c * this.mNearClippingDistance / this.mConvergence;

        const projection = m4.frustum(leftF, rightF, bottom, top,
            this.mNearClippingDistance, this.mFarClippingDistance)
        const modelview = m4.translation(this.mEyeSeparation / 2, 0.0, 0.0)
        return [projection, modelview]
    }

    this.ApplyRightFrustum = function () {
        let top, bottom, leftF, rightF;

        top = this.mNearClippingDistance * tan(this.mFOV / 2);
        bottom = -top;

        const Al = this.mAspectRatio * tan(this.mFOV / 2) * this.mConvergence;

        const b = Al - this.mEyeSeparation / 2;
        const c = Al + this.mEyeSeparation / 2;

        leftF = -c * this.mNearClippingDistance / this.mConvergence;
        rightF = b * this.mNearClippingDistance / this.mConvergence;

        const projection = m4.frustum(leftF, rightF, bottom, top,
            this.mNearClippingDistance, this.mFarClippingDistance);
        const modelview = m4.translation(-this.mEyeSeparation / 2, 0.0, 0.0);
        return [projection, modelview]
    }
}
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iTextureBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function (vertices, textures) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textures), gl.STREAM_DRAW);

        this.count = vertices.length / 3;
    }

    this.Draw = function () {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTexture, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTexture);

        gl.drawArrays(gl.TRIANGLES, 0, this.count);
    }
}
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;
    this.iAttribVertex = -1;
    this.iColor = -1;
    this.iModelViewProjectionMatrix = -1;

    this.Use = function () {
        gl.useProgram(this.prog);
    }
}
function draw() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let projection = m4.perspective(PI / 8, 1, 8, 12);


    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

    let [pM, mM] = stereoCamera.ApplyLeftFrustum()
    let modelViewProjection = m4.multiply(pM, m4.multiply(mM, matAccum1));
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.colorMask(true, false, false, false);

    
    gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);
    surface.Draw();

    gl.clear(gl.DEPTH_BUFFER_BIT);

    [pM, mM] = stereoCamera.ApplyRightFrustum()
    modelViewProjection = m4.multiply(pM, m4.multiply(mM, matAccum1));
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.colorMask(false, true, true, false);
    surface.Draw();

    gl.colorMask(true, true, true, true);
}

const c = 5
const H = 1
const a = 0.033 * Math.PI
const fi = 0
const p = 8 * Math.PI
let omega = 0


const scaler = 0.1;

function cassiniVertex(u, v) {
    omega = p * u
    let x = (c * u + v * (Math.sin(fi) + Math.tan(a) * Math.cos(fi) * Math.cos(omega))),


        y = (v * Math.tan(a) * Math.sin(omega)),


        cV = (H + v * (Math.tan(a) * Math.sin(fi) * Math.cos(omega) - Math.cos(fi)));


    return [scaler * x, scaler * y, scaler * cV];
}

function CreateTextures() {
    let textureList = []
    const MAX_U = 1,
        MAX_V = 5,
        STEP_U = 0.01,
        STEP_V = 0.2
    omega = 0
    for (let u = 0; u <= MAX_U; u += STEP_U) {
        for (let v = -5; v <= MAX_V; v += STEP_V) {
            textureList.push(u, map(v, -5, MAX_V, 0, 1))
            textureList.push(u + STEP_U, map(v, -5, MAX_V, 0, 1))
            textureList.push(u, map(v + STEP_V, -5, MAX_V, 0, 1))
            textureList.push(u, map(v + STEP_V, -5, MAX_V, 0, 1))
            textureList.push(u + STEP_U, map(v, -5, MAX_V, 0, 1))
            textureList.push(u + STEP_U, map(v + STEP_V, -5, MAX_V, 0, 1))
        }
    }
    return textureList;
}
function map(value, a, b, c, d) {
    value = (value - a) / (b - a);
    return c + value * (d - c);
}
function CreateSurfaceData() {
    let vertexList = [];
    const MAX_U = 1,
        MAX_V = 5,
        STEP_U = 0.01,
        STEP_V = 0.2
    for (let u = 0; u <= MAX_U; u += STEP_U) {
        for (let v = -5; v <= MAX_V; v += STEP_V) {
            let vertex = cassiniVertex(u, v)
            vertexList.push(...vertex)
            vertex = cassiniVertex(u + STEP_U, v)
            vertexList.push(...vertex)
            vertex = cassiniVertex(u, v + STEP_V)
            vertexList.push(...vertex)
            vertexList.push(...vertex)
            vertex = cassiniVertex(u + STEP_U, v)
            vertexList.push(...vertex)
            vertex = cassiniVertex(u + STEP_U, v + STEP_V)
            vertexList.push(...vertex)
        }
    }
    return vertexList;
}

/* Initialize the WebGL context. Called from init() */
let convergInput, eyeSepInput, foViewInput, ncDistInput;
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribTexture = gl.getAttribLocation(prog, "texture");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor = gl.getUniformLocation(prog, "color");
    shProgram.iTMU = gl.getUniformLocation(prog, 'tmu');
    convergInput = document.getElementById('converg')
    eyeSepInput = document.getElementById('eyeSep')
    foViewInput = document.getElementById('foView')
    ncDistInput = document.getElementById('ncDist')
    convergInput.addEventListener("change", () => {
        converg = convergInput.value
        stereoCamera.mConvergence = converg
        draw()
    })
    eyeSepInput.addEventListener("change", () => {
        eyeSep = eyeSepInput.value
        stereoCamera.mEyeSeparation = eyeSep
        draw()
    })
    foViewInput.addEventListener("change", () => {
        foView = deg2rad(foViewInput.value)
        stereoCamera.mFOV = foView
        draw()
    })
    ncDistInput.addEventListener("change", () => {
        ncDist = ncDistInput.value
        stereoCamera.mNearClippingDistance = parseFloat(ncDistInput.value)
        console.log(stereoCamera.mNearClippingDistance)
        draw()
    })
    stereoCamera = new StereoCamera(converg, eyeSep, 1, foView, ncDist, 12)
    LoadTexture();

    surface = new Model('Surface');
    surface.BufferData(CreateSurfaceData(), CreateTextures());

    gl.enable(gl.DEPTH_TEST);
}
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize 
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    draw();
}

function LoadTexture() {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const image = new Image();
    image.crossOrigin = 'anonymus';
    image.src = "https://raw.githubusercontent.com/4ertaile/Methods-of-virtual-reality-synthesis/PA1/texture.jpg";
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
        );
        console.log("imageLoaded")
        draw()
    }
}