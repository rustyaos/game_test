"use client";

import { useEffect, useRef } from "react";

import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { SceneLoaderFlags } from "@babylonjs/core/Loading/sceneLoaderFlags";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";

import HavokPhysics from "@babylonjs/havok";
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Loading/Plugins/babylonFileLoader";

import "@babylonjs/core/Cameras/universalCamera";

import "@babylonjs/core/Meshes/groundMesh";

import "@babylonjs/core/Lights/directionalLight";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Materials/PBR/pbrMaterial";
import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/XR/features/WebXRDepthSensing";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Materials/Textures/Loaders/envTextureLoader";
import "@babylonjs/core/Physics";
import "@babylonjs/inspector";
import "@babylonjs/materials/sky";


import { loadScene } from "babylonjs-editor-tools";

/**
 * We import the map of all scripts attached to objects in the editor.
 * This will allow the loader from `babylonjs-editor-tools` to attach the scripts to the
 * loaded objects (scene, meshes, transform nodes, lights, cameras, etc.).
 */
import { scriptsMap } from "@/scripts";
import * as BABYLON from "@babylonjs/core"; // Import BABYLON namespace

// Expose BABYLON globally for inspector integration
if (typeof window !== 'undefined') {
	(window as any).BABYLON = BABYLON;
}

export default function Home() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {

		// Minimal invasive editor integration - just load the bridge script

		console.log('[GameTest] Editor mode detected, loading bridge script');
		// Load editor bridge script dynamically
		const script = document.createElement('script');
		// Use hostname to allow access from local network IP
		script.src = `/bridge.js`;
		script.onload = () => {
			console.log('[GameTest] Editor bridge script loaded successfully');
		};
		script.onerror = () => {
			console.warn('[GameTest] Failed to load editor bridge script');
		};
		const container = document.body ?? document.documentElement;
		container.appendChild(script);


	}, []);

	useEffect(() => {
		if (!canvasRef.current) {
			return;
		}

		const engine = new Engine(canvasRef.current, true, {
			stencil: true,
			antialias: true,
			audioEngine: true,
			adaptToDeviceRatio: true,
			disableWebGL2Support: false,
			useHighPrecisionFloats: true,
			powerPreference: "high-performance",
			failIfMajorPerformanceCaveat: false,
		});

		const scene = new Scene(engine);

		scene.debugLayer.show({
			overlay: true,
		});

		const handleLoad = async () => {
			const havok = await HavokPhysics();
			scene.enablePhysics(new Vector3(0, -981, 0), new HavokPlugin(true, havok));

			SceneLoaderFlags.ForceFullSceneLoadingForIncremental = true;
			await loadScene("/scene/", "example.babylon", scene, scriptsMap, {
				quality: "high",
			});

			if (scene.activeCamera) {
				scene.activeCamera.attachControl();
			}

			engine.runRenderLoop(() => {
				scene.render();
			});
		};

		void handleLoad();

		let listener: () => void;
		window.addEventListener("resize", listener = () => {
			engine.resize();
		});

		return () => {
			scene.dispose();
			engine.dispose();

			window.removeEventListener("resize", listener);
		};
	}, [canvasRef]);

	return (
		<main className="flex w-screen h-screen flex-col items-center justify-between">
			<canvas
				ref={canvasRef}
				className="w-full h-full outline-none select-none"
			/>
		</main>
	);
}

