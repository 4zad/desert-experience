import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import {
    WebGLRenderer,
    PerspectiveCamera,
    Scene,
    GridHelper,
    AxesHelper,
    Vector3,
    CameraHelper,
    sRGBEncoding,
    ACESFilmicToneMapping,
    MathUtils
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';

import materialModifier, { ShaderConfig } from '@jam3/webgl-components/materials/material-modifier';
import { simplexNoise3D, simplexNoise4D } from '@jam3/webgl-components/shaders/noise/simplex.glsl';

// import { gui, guiController } from "./js/gui";
// import { renderStats } from "./js/stats";

const Artwork = () => {
    const inputEl = useRef(null);

    useEffect(() => {
        // ======================================================================================================
        // CAMERAS & MOVEMENT & RENDERING
        // ======================================================================================================

        let cameras,
            scene,
            renderer;

        let sky,
            sun;

        let cameraClock = new THREE.Clock(),
            angle = 0,
            angularSpeed = Math.PI / 18,
            radius = 150;

        let orgSphereAltitude = 50.0,
            orgSphereClock = new THREE.Clock(),
            customShader;

        let cinematic = false;

        // Create two cameras
        // One for developing, the other for the final view
        cameras = {
            dev: new PerspectiveCamera(
                65,
                window.innerWidth / window.innerHeight,
                0.1,
                1000
            ),
            main: new PerspectiveCamera(
                65,
                window.innerWidth / window.innerHeight,
                0.1,
                1000
            ),
        };

        cameras.dev.position.set(20, 10, 20);
        cameras.dev.lookAt(new Vector3(0, 0, 0));

        // Create our scene graph
        scene = new Scene();

        // Add some debug helpers
        // scene.add(
        //     new GridHelper(20, 10, 0x000000, 0x000000),
        //     new AxesHelper(),
        //     new CameraHelper(cameras.main),
        // );

        // Setup the webgl renderer
        renderer = new WebGLRenderer({ antialias: true });
        renderer.debug.checkShaderErrors = true;
        renderer.setScissorTest(true);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.outputEncoding = sRGBEncoding;
        renderer.toneMapping = ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.5;
        document.body.appendChild(renderer.domElement);

        // Create two sets of orbit controls
        // One for developing, the other for user control
        const controls = {
            dev: new OrbitControls(cameras.dev, renderer.domElement),
            main: new OrbitControls(cameras.main, renderer.domElement),
        };

        controls.main.addEventListener('change', renderScene);

        function onResize() {
            // Update camera projections
            cameras.dev.aspect = window.innerWidth / window.innerHeight;
            cameras.dev.updateProjectionMatrix();
            // Set webgl context size
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        // Render the scene with viewport coords
        function renderScene(camera, left, bottom, width, height) {
            left *= window.innerWidth;
            bottom *= window.innerHeight;
            width *= window.innerWidth;
            height *= window.innerHeight;

            renderer.setViewport(left, bottom, width, height);
            renderer.setScissor(left, bottom, width, height);

            // const composer = new EffectComposer(renderer);
            // const renderModel = new RenderPass(scene, cameras.main);
            // const effectFilm = new FilmPass(0.35, 0.75, 2048, false);

            // composer.addPass(renderModel);
            // composer.addPass(effectFilm);

            // create automatic camera motion
            function animateCamera() {
                requestAnimationFrame(animateCamera);

                // Set initial camera positions
                cameras.main.position.x = cinematic ? orgSphereAltitude : Math.cos(angle) * radius;
                cameras.main.position.y = cinematic ? 5.0 : orgSphereAltitude * 4 / 5;
                cameras.main.position.z = cinematic ? (Math.sin(angle) * radius) - 100.0 : Math.sin(angle) * radius;
                cameras.main.lookAt(new Vector3(0.0, orgSphereAltitude + 10.0, 0.0));
                angle += angularSpeed * cameraClock.getDelta();
            }
            // Initialize the respective animation on main camera (cameras.main)
            animateCamera();

            // render scene
            renderer.render(scene, camera);
        }

        function update() {
            if (customShader != null) {
                customShader.uniforms.time.value += orgSphereClock.getDelta();
            }
            requestAnimationFrame(update);
            // Enable main camera controls when not in dev mode
            // controls.main.enabled = !guiController.cameraDebug;
            controls.main.update();

            // Handle scene rendering
            // if (guiController.cameraDebug) {
            //     renderScene(cameras.dev, 0, 0, 1, 1);
            //     renderScene(cameras.main, 0, 0, 0.25, 0.25);
            // } else {
            renderScene(cameras.main, 0, 0, 1, 1);
            // }


            // Update render stats
            // renderStats.update(renderer);
        }

        window.addEventListener("resize", onResize);

        // Begin render loop
        update();



        // ======================================================================================================
        // SKY & SKY SHADERS
        // ======================================================================================================

        function initializeSky() {

            // Add Sky
            sky = new Sky();
            sky.scale.setScalar(450000);
            scene.add(sky);

            sun = new THREE.Vector3();

            /// GUI
            const effectController = {
                turbidity: 20,
                rayleigh: 2,
                mieCoefficient: 0.005,
                mieDirectionalG: 0.95,
                elevation: 1,
                azimuth: 180,
                exposure: 0.35
            };

            function guiChanged() {

                const uniforms = sky.material.uniforms;
                uniforms['turbidity'].value = effectController.turbidity;
                uniforms['rayleigh'].value = effectController.rayleigh;
                uniforms['mieCoefficient'].value = effectController.mieCoefficient;
                uniforms['mieDirectionalG'].value = effectController.mieDirectionalG;

                const phi = MathUtils.degToRad(90 - effectController.elevation);
                const theta = MathUtils.degToRad(effectController.azimuth);

                sun.setFromSphericalCoords(1, phi, theta);

                uniforms['sunPosition'].value.copy(sun);

                renderer.toneMappingExposure = effectController.exposure;
            }

            // GUI controls
            // gui.add(effectController, 'turbidity', 0.0, 20.0, 0.1).onChange(guiChanged);
            // gui.add(effectController, 'rayleigh', 0.0, 4, 0.001).onChange(guiChanged);
            // gui.add(effectController, 'mieCoefficient', 0.0, 0.1, 0.001).onChange(guiChanged);
            // gui.add(effectController, 'mieDirectionalG', 0.0, 1, 0.001).onChange(guiChanged);
            // gui.add(effectController, 'elevation', 0, 90, 0.1).onChange(guiChanged);
            // gui.add(effectController, 'azimuth', - 180, 180, 0.1).onChange(guiChanged);
            // gui.add(effectController, 'exposure', 0, 1, 0.0001).onChange(guiChanged);

            guiChanged();
        }

        // Initilize the sunset sky view
        initializeSky();


        // ======================================================================================================
        // OBJECTS
        // ======================================================================================================

        // ------------------------------------------------------------------------------------------------------
        // creating the terrain using a baseplate and height map
        // the base geometry for the terrain
        const terrainGeometry = new THREE.PlaneGeometry(1000, 1000, 512, 512);

        // creating the properties and material of the terrain
        // defining the height map
        const textureMapTexture = new THREE.TextureLoader().setPath(`./assets/images/`).load(
            `textureMap_curvyLines.jpeg`
        );

        // defining the height map
        const heightMapTexture = new THREE.TextureLoader().setPath(`./assets/images/`).load(
            `heightMap_sandDunes.png`
        );
        heightMapTexture.wrapS = THREE.RepeatWrapping;
        heightMapTexture.wrapT = THREE.RepeatWrapping;
        heightMapTexture.repeat.set(1, 1);

        // defining the alpha map
        const alphaMapTexture = new THREE.TextureLoader()
            .setPath(`./assets/images/`)
            .load(`alphaMap.png`);

        const terrainMaterial = new THREE.MeshStandardMaterial({
            wireframe: false,
            color: 0xcb997e,
            map: textureMapTexture,
            displacementMap: heightMapTexture,
            displacementScale: 90,
            bumpMap: heightMapTexture,
            bumpScale: 1,
            alphaMap: alphaMapTexture,
            transparent: true,
            depthTest: false,
        });

        const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);

        // creating the organic sphere geometry that user may interact with
        const shaderConfig = {
            uniforms: {
                time: { value: 0 }
            },
            defines: {
                USE_TANGENTS: ``
            },
            vertexShader: {
                uniforms: /* glsl */ `
                    uniform float time;
                    varying vec3 vNormal;
                    varying float vNoise;
                    varying vec3 vColor;
                `,
                functions: `
                    ${simplexNoise4D}
                `,
                preTransform: ``,
                postTransform: /* glsl */ `
                    // displacement
                    float m_speedDisplace = time / 25.0;
                    float m_strengthDisplace = 5.0;
                    float m_frequencyDisplace = 0.05;

                    vec3 displacement = position;
                    displacement = vec3(simplexNoise4D(vec4(displacement.xyz * m_frequencyDisplace, m_speedDisplace))) * m_strengthDisplace;
                    
                    // noise
                    float m_speedNoise = time / 100.0;
                    float m_strengthNoise = 2.0;
                    float m_frequencyNoise = 1.0;

                    float noise = simplexNoise4D(vec4(displacement.xyz * m_frequencyNoise, m_speedNoise));

                    // creating new distortion map 
                    vec3 modifiedPosition = position;
                    modifiedPosition += normal * noise * m_strengthNoise;

                    // distorting and positioning
                    vec4 viewPosition = modelMatrix * viewMatrix * vec4(modifiedPosition, 1.0);
                    gl_Position = projectionMatrix * viewPosition;

                    // defining color and lighting
                    vec3 lightColorA = vec3(0.8, 0.6, 0.5);
                    vec3 lightPositionA = vec3(0.0, 0.0, -1.0);
                    float lightMapA = max(-0.3, -dot(normal, normalize(-lightPositionA)));

                    vec3 lightColorB = vec3(0.28, 0.2, 0.15);
                    vec3 lightPositionB = vec3(0.0, -1.0, 0.0);
                    float lightMapB = -dot(normal, normalize(-lightPositionB)) - 0.1;

                    vec3 lightColorC = vec3(0.28, 0.2, 0.15);
                    vec3 lightPositionC = vec3(0.0, 1.0, 0.0);
                    float lightMapC = -dot(normal, normalize(-lightPositionC)) - 0.1;

                    vec3 lightColorD = vec3(0.28, 0.2, 0.15);
                    vec3 lightPositionD = vec3(-1.0, 0.0, 0.0);
                    float lightMapD = -dot(normal, normalize(-lightPositionD)) - 0.1;

                    vec3 lightColorE = vec3(0.28, 0.2, 0.15);
                    vec3 lightPositionE = vec3(1.0, 0.0, 0.0);
                    float lightMapE = -dot(normal, normalize(-lightPositionE)) - 0.1;

                    vec3 color = vec3(0.28, 0.2, 0.15);
                    color = mix(color, lightColorA, lightMapA);
                    color = mix(color, lightColorB, lightMapB);
                    color = mix(color, lightColorC, lightMapC);
                    color = mix(color, lightColorD, lightMapD);
                    color = mix(color, lightColorE, lightMapE);

                    // global vars
                    vNormal = normal;
                    vNoise = noise;
                    vColor = color;
                `
            },
            fragmentShader: {
                uniforms: /* glsl */ `
                    varying vec3 vNormal;
                    varying float vNoise;
                    varying vec3 vColor;
                `,
                functions: ``,
                outgoingLightColor: /* glsl */ ``,
                fragColor: /* glsl */ `
                    gl_FragColor = vec4(vColor, 1.0);
                `
            }
        };
        const shaderMaterial = new THREE.MeshLambertMaterial();
        shaderMaterial.onBeforeCompile = (shader) => {
            customShader = materialModifier(shader, shaderConfig);
        };

        const orgSphereGeometry = new THREE.SphereGeometry(16, 1024, 1024);
        orgSphereGeometry.computeTangents();

        const orgSphere = new THREE.Mesh(orgSphereGeometry, shaderMaterial);



        // ======================================================================================================
        // SCENE
        // ======================================================================================================

        // adding the terrain to the scene and position it appropriately
        scene.add(terrain);
        terrain.rotation.x = -(Math.PI / 2); // rotation defined in radians
        terrain.position.y = -50.0;
        // gui.add(terrain.rotation, "x").min(0).max(2 * Math.PI);
        // gui.add(terrain.position, "y").min(-100).max(100);

        // adding the organic sphere geometry to the scene and positioning it appropriately
        scene.add(orgSphere);
        orgSphere.position.y = orgSphereAltitude;

        const light = new THREE.AmbientLight(0xffb991, 0.7); // soft white light
        scene.add(light);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 10.0);
        directionalLight.position.set(0, 50, -2000); // positioning light a to the same position as the sun in the sky
        scene.add(directionalLight);
        directionalLight.target(0, -200, 0) // directing the light to target down and even a little below the terrain for moody/dramatic look
        scene.add(directionalLight.target);

        // introducing fog into the scene
        scene.fog = new THREE.FogExp2(0xffe8d6, 0.0005);
    }, []);

    return (
        <>
            <div ref={inputEl}></div>
        </>
    );
};

export default Artwork;
