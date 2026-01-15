/**
 * Babylon.js Editor Bridge - Lightweight remote editing integration
 */

(function () {
  'use strict';

  const log = (msg, ...args) => console.log(`[EditorBridge] ${msg}`, ...args);
  const warn = (msg, ...args) => console.warn(`[EditorBridge] ${msg}`, ...args);
  const error = (msg, ...args) => console.error(`[EditorBridge] ${msg}`, ...args);

  log('Initializing...');

  // Wait for BABYLON.js
  let checkCount = 0;
  const babylonCheckInterval = setInterval(() => {
    checkCount++;
    if (window.BABYLON?.Scene) {
      clearInterval(babylonCheckInterval);
      log('BABYLON.js detected, initializing bridge...');
      initEditor();
    } else if (checkCount > 50) {
      clearInterval(babylonCheckInterval);
      warn('BABYLON.js not found after 5 seconds');
    }
  }, 100);

  function initEditor() {
    // Wait for scene to be ready
    let sceneCheckCount = 0;
    const sceneCheckInterval = setInterval(() => {
      sceneCheckCount++;
      const scene = findActiveScene();

      if (scene && (scene.meshes?.length || scene.lights?.length || scene.cameras?.length)) {
        clearInterval(sceneCheckInterval);
        initBridge(scene);
      } else if (sceneCheckCount > 50) {
        clearInterval(sceneCheckInterval);
        if (scene) proceedWithBridgeInitialization(scene);
        else warn('No scene found after 5 seconds');
      }
    }, 100);
  }

  function initBridge(scene) {
    log('Scene ready, initializing bridge...');

    window.editorBridgeStatus = { ...window.editorBridgeStatus, sceneFound: true, lastUpdate: new Date().toISOString() };


    console.log('[EditorBridge] Connecting to editor WebSocket...');

    // Parse sandbox ID from E2B URL (e.g., https://4096-i7foivqyu3ppfh5qocx0l.e2b.app/)
    const currentUrl = window.location.href;
    const urlMatch = currentUrl.match(/https?:\/\/\d+-([a-z0-9]+)\.e2b\.(app|dev)/);
    const sandboxId = urlMatch ? urlMatch[1] : null;
    
    // Construct WebSocket host: use E2B sandbox URL if available, otherwise localhost
    const host = sandboxId 
      ? `wss://8080-${sandboxId}.e2b.app/api/shadow-proxy`
      : 'ws://localhost:8080/api/shadow-proxy';
    
    console.log('[EditorBridge] Sandbox ID:', sandboxId || 'localhost');
    console.log('[EditorBridge] WebSocket host:', host);
    
    // Connect to editor WebSocket
    const ws = new WebSocket(host);
    let inspectorShown = false;

    ws.onopen = async () => {
      log('WebSocket connected');
      window.editorBridgeStatus = { ...window.editorBridgeStatus, websocketConnected: true };

      setTimeout(async () => {
        const inspectorResult = await showInspector(scene);
        window.editorBridgeStatus = { ...window.editorBridgeStatus, inspectorShown: inspectorResult };

        sendSceneTree(ws, scene);
        // 发送握手消息
        ws.send(JSON.stringify({
          type: 'handshake',
          clientType: 'editor',
          timestamp: new Date().toISOString()
        }));
        setupEvents(scene, ws);
      }, 1000);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        log('Received command:', message.type);
        onCommand(scene, message);
      } catch (error) {
        error('Failed to parse message:', error);
      }
    };

    ws.onclose = (event) => {
      log('WebSocket closed');
      window.editorBridgeStatus = { ...window.editorBridgeStatus, websocketConnected: false };
      hideInspector(scene);
    };

    ws.onerror = () => {
      error('WebSocket error, reconnecting in 3s...');
      setTimeout(initEditor, 3000);
    };

    // Store WebSocket reference for cleanup
    window.editorBridgeWS = ws;
  }

  function findActiveScene() {
    // Check BABYLON engines first
    const engines = window.BABYLON?.Engine?.Instances || [];
    for (const engine of engines) {
      if (engine.scenes?.length) {
        // Return scene with active camera, or first scene
        return engine.scenes.find(s => s.activeCamera) || engine.scenes[0];
      }
    }

    // Fallback to common global variables
    const candidates = [window.gameScene, window.scene, window.currentScene, window.activeScene, window.mainScene];
    return candidates.find(scene => scene instanceof window.BABYLON.Scene) || null;
  }

  function showInspector(scene) {
    if (!scene.debugLayer) {
      warn('No debugLayer available');
      return Promise.resolve(false);
    }

    if (!window.BABYLON?.Inspector) {
      warn('BABYLON.Inspector not available');
      return Promise.resolve(false);
    }

    try {
      // Force initialization if needed
      if (!window.BABYLON.Inspector._Initialized) {
        window.BABYLON.Inspector._Initialize?.();
      }

      // Show with optimized config
      scene.debugLayer.show({
        embedMode: true,
        overlay: true,
        enableSelection: true,
        showExplorer: true,
        enablePopup: false,
        globalRoot: document.body
      });


      // Verify after delay
      return new Promise((resolve) => {
        setTimeout(() => {
          const elements = document.querySelectorAll('[class*="inspector"], [id*="inspector"]');
          const isVisible = scene.debugLayer.isVisible?.() === true;
          resolve(elements.length > 0 || isVisible);
        }, 2000);
      });

    } catch (error) {
      log('Inspector show failed, trying fallback...');
      try {
        scene.debugLayer.show();
        return new Promise((resolve) => {
          setTimeout(() => {
            const elements = document.querySelectorAll('[class*="inspector"]');
            resolve(elements.length > 0);
          }, 1000);
        });
      } catch (fallbackError) {
        error('Fallback Inspector show also failed:', fallbackError);
        return Promise.resolve(false);
      }
    }
  }

  function hideInspector(scene) {
    if (scene.debugLayer) {
      scene.debugLayer.hide();
      console.log('[EditorBridge] Inspector hidden');
    }
  }


  function sendSceneTree(ws, scene) {
    console.log(`[EditorBridge] send scene data : \n`, scene)
    try {
      const createNode = (obj) => {
        console.log('>>>>>>>>>>>>>>>>>> obj', obj);

        // 安全辅助函数
        const safeArray = (arr, defaultValue = [0, 0, 0]) => {
          try {
            return arr && typeof arr.asArray === 'function'
              ? arr.asArray().map(v => +v.toFixed(2))
              : defaultValue;
          } catch (error) {
            return defaultValue;
          }
        };

        const safeValue = (value, defaultValue = null) => {
          try {
            return value !== undefined ? value : defaultValue;
          } catch (error) {
            return defaultValue;
          }
        };

        const nodeData = {
          id: obj.name || obj.id,
          name: obj.name || `Unnamed ${obj.getClassName?.() || 'Object'}`,
          className: obj.getClassName?.() || 'Object',
          // 1. 空间信息：保留 2 位小数节省 Token
          transform: {
            position: safeArray(obj.position),
            absolutePosition: safeArray(obj.absolutePosition),
            // 将四元数转为欧拉角，AI 更容易理解如何旋转
            rotation: obj.rotationQuaternion
              ? safeArray(obj.rotationQuaternion.toEulerAngles(), [0, 0, 0]).map(v => +(v * 180 / Math.PI).toFixed(2))
              : safeArray(obj.rotation),
            scaling: safeArray(obj.scaling, [1, 1, 1])
          },
          // 2. 业务元数据
          metadata: obj.metadata,
          // 3. 交互状态
          interaction: {
            isPickable: safeValue(obj.isPickable, true),
            hasPhysics: !!(obj.physicsBody || obj.physicsImpostor)
          },
          // 4. 溯源（非常重要！）
          assetSource: obj.delayLoadingFile || "primitive"
        };

        // 5. 渲染特征 - 只在有材质时添加
        if (obj.material) {
          try {
            nodeData.material = {
              type: obj.material.type || 'unknown',
              diffuseColor: safeArray(obj.material.diffuseColor, [1, 1, 1]),
              specularColor: safeArray(obj.material.specularColor, [0, 0, 0]),
              textures: obj.material.textures
                ? obj.material.textures.map(t => t.name || 'unnamed').filter(Boolean)
                : []
            };
          } catch (error) {
            console.warn('[EditorBridge] Failed to process material for', obj.name, error);
          }
        }

        // 6. 几何信息 - 只在有几何体时添加
        if (obj.geometry) {
          try {
            nodeData.geometry = {
              vertices: obj.geometry.vertices ? obj.geometry.vertices.length : 0,
              faces: obj.geometry.faces ? obj.geometry.faces.length : 0,
              boundingBox: obj.geometry.boundingBox ? {
                min: safeArray(obj.geometry.boundingBox.min),
                max: safeArray(obj.geometry.boundingBox.max)
              } : undefined
            };
          } catch (error) {
            console.warn('[EditorBridge] Failed to process geometry for', obj.name, error);
          }
        }

        console.log(`[EditorBridge] Node ${obj.name}:`, JSON.stringify(nodeData));

        return nodeData;
      };

      const sceneTree = [
        ...(scene.meshes || []).map(createNode),
        ...(scene.lights || []).map(createNode),
        ...(scene.cameras || []).map(createNode)
      ];

      console.log('[EditorBridge] Sending scene update:', JSON.stringify(sceneTree));
      ws.send(JSON.stringify({
        type: 'scene_update',
        data: sceneTree,
        timestamp: new Date().toISOString()
      }));
      log(`Sent scene tree with ${sceneTree.length} objects`);
    } catch (error) {
      console.log('Failed to send scene tree:', error);
    }
  }

  function setupEvents(scene, ws) {
    if (!scene.debugLayer) return;

    // Selection change listener
    scene.debugLayer.onSelectionChangedObservable?.add((entity) => {
      if (ws.readyState === WebSocket.OPEN && entity) {
        const transform = {
          position: { x: entity.position?.x || 0, y: entity.position?.y || 0, z: entity.position?.z || 0 },
          rotation: { x: entity.rotation?.x || 0, y: entity.rotation?.y || 0, z: entity.rotation?.z || 0 },
          scale: { x: entity.scaling?.x || 1, y: entity.scaling?.y || 1, z: entity.scaling?.z || 1 }
        };

        log('[EditorBridge] Sending selection changed:', entity);
        ws.send(JSON.stringify({
          type: 'selection_change',
          data: {
            id: entity.name || entity.id,
            name: entity.name || 'Unnamed',
            className: entity.getClassName?.() || 'Unknown',
            transform
          },
          timestamp: new Date().toISOString()
        }));
      }
    });

    // Property change listener
    scene.debugLayer.onPropertyChangedObservable?.add((event) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'property_change',
          data: event,
          timestamp: new Date().toISOString()
        }));
      }
    });

    log('Inspector events set up');
  }




  function onCommand(scene, message) {
    log('Handling command:', message.type);

    const ws = window.editorBridgeWS;
    switch (message.type) {
      case 'get_scene_tree':
        if (ws?.readyState === WebSocket.OPEN) sendSceneTree(ws, scene);
        break;

      case 'select_object':
        if (message.payload?.objectId && scene.debugLayer) {
          const node = scene.getNodeByName(message.payload.objectId);
          if (node) scene.debugLayer.select(node);
        }
        break;

      case 'set_transform':
        if (message.payload?.objectId) {
          const node = scene.getNodeByName(message.payload.objectId);
          const transform = message.payload.transform;
          if (node && transform) {
            if (transform.position) Object.assign(node.position, transform.position);
            if (transform.rotation) Object.assign(node.rotation, transform.rotation);
            if (transform.scale) Object.assign(node.scaling, transform.scale);
          }
        }
        break;
    }
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    window.editorBridgeWS?.close();
  });

  // Global status for debugging
  window.editorBridgeStatus = {
    initialized: true,
    babylonAvailable: !!window.BABYLON,
    sceneFound: false,
    websocketConnected: false,
    inspectorShown: false,
    sceneLoaded: false,
    projectId: null,
    objectCount: 0,
    lastUpdate: new Date().toISOString()
  };

  log('Bridge initialized');
})();
