// scenes/MainScene.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { MyInput } from '../utils/InputUtils.js';
import { Scene } from "./base_scene.js";
import { MainAsset } from "./MainAsset.js";
import { Exec } from "./MainExec.js";
import { Spawn, SpawnScheduler } from "./MainSpawn.js";
import { UI } from "./UI.js";
import { TitleScene } from "./TitleScene.js";
import { GameOverScene } from "./GameOverScene.js";
import { GameClearScene } from "./GameClearScene.js";
import { Wipe } from "../utils/DrawUtils.js";
import { Game } from '../main.js';

export class MainScene extends Scene {
    constructor(game) {
        super(game);
        this.map = null;
        this.isInitialized = false;
        this.stage_state_count = 0;

        GameState.stage_state = GLOBALS.STAGE_STATE.START;

        this.sunLight_colors = [
            {t:0.00, r:0.6, g:0.0, b:0.0, i: 5.0},
            {t:0.25, r:0.5, g:0.8, b:1.0, i:10.0},
            {t:0.50, r:1.0, g:0.0, b:0.2, i: 1.0},
            {t:0.58, r:0.0, g:0.0, b:1.0, i: 0.2},
            {t:0.75, r:0.0, g:0.0, b:0.1, i: 0.1},
            {t:0.90, r:0.0, g:0.0, b:0.1, i: 1.0},
            {t:0.95, r:1.0, g:0.1, b:0.1, i: 2.0},
            {t:1.00, r:0.6, g:0.0, b:0.0, i: 5.0}
        ]
        this.background_colors = [
            {t:0.00, r:0.20, g:0.00, b:0.00, i:0.0},
            {t:0.05, r:0.02, g:0.06, b:0.30, i:0.0},
            {t:0.25, r:0.01, g:0.10, b:0.50, i:0.0},
            {t:0.40, r:0.02, g:0.08, b:0.30, i:0.0},
            {t:0.50, r:0.30, g:0.02, b:0.10, i:0.0},
            {t:0.55, r:0.00, g:0.00, b:0.15, i:0.0},
            {t:0.75, r:0.00, g:0.00, b:0.10, i:0.0},
            {t:0.95, r:0.00, g:0.00, b:0.05, i:0.0},
            {t:1.00, r:0.20, g:0.00, b:0.00, i:0.0}
        ]
    }

    // ■ セットアップ
    setup(){
        // Camera(main)
        const camera = new BABYLON.FreeCamera("FreeCam", new BABYLON.Vector3(0, 0, -10), this.scene);
        camera.inputs.clear();
        camera.fov = 1.3; // 視野角
        camera.minZ = 0.1;
        camera.attachControl(this.game.canvas, true);
        camera.layerMask &= ~GLOBALS.MASK_UI;
        GameState.camera = camera;

        // camera(ui)
        const uiCamera = new BABYLON.FreeCamera("uiCam", BABYLON.Vector3.Zero(), this.scene);
        uiCamera.layerMask = GLOBALS.MASK_UI;

        // 描画順の制御のために activeCameras を設定
        this.scene.activeCameras = [camera, uiCamera];

        // bloom
        const imgproc= this.scene.imageProcessingConfiguration;
        imgproc.toneMappingEnabled = true;
        imgproc.exposure = 1.1;
        imgproc.contrast = 1.0;
        const pipeline = new BABYLON.DefaultRenderingPipeline("default", true, this.scene, [camera]);
        pipeline.bloomEnabled = true;
        pipeline.bloomThreshold = 0.3; // どの明るさから発光させるか
        pipeline.bloomIntensity = 2.0; // 発光の強さ
        pipeline.bloomKernel = 128;    // ブラーの広がり具合
    }

    // ■ プリロード
    async preload(){
        // console.log("GameScene.preload");
        GameState.asset = new MainAsset(this.scene);
        await GameState.asset.preload();
    }

    // ■ 初期生成
    create() {
        // console.log("GameScene.create");
        const scene = this.scene;
        scene.clearColor = new BABYLON.Color4(0.0, 0.03, 0.10, 1.0);

        // ■ ライト
        // ◇半球ライト（環境光）
        const hemiLight = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0.5, 1.0, 0.0), scene);
        hemiLight.intensity = 0.05;
        hemiLight.groundColor = new BABYLON.Color3(0.05, 0.05, 0.1);

        // ◇平行光源（太陽光）
        this.DAY_SPEED = 0.004; // 時間の進行速度 0.004
        this.FLUCTUATION_SPEED = 0.007; // ゆらぎ光の周波数
        this.sunLight = new BABYLON.DirectionalLight( "sun", new BABYLON.Vector3(-1, -1, 0),  scene);
        this.sunLight.diffuse = new BABYLON.Color3();
        this.timeOfDay = 0.75; // 0=朝、0.25=正午、0.5=夕方、0.75=真夜中
        this.fluctuation = 0;
        this.tmp_sunLightDirection = new BABYLON.Vector3();
        this.tmp_timedColor = {r:0, g:0, b:0, i:0};

        // フォグ
        scene.fogEnabled = true;
        scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
        scene.fogColor = new BABYLON.Color3(0.2, 0.3, 0.8); //青っぽく
        scene.fogStart = 15.0;
        scene.fogEnd = 25.0;

        // シーン内の当たり判定の有効化
        scene.collisionsEnabled = false;

        // 経過時間のクリア
        GameState.elapsed_time = 0;

        // UI画面の生成
        GameState.ui_manager = new UI(this.scene);

        // 入力ユーティリティの生成
        this.my_input = new MyInput(scene, this.game);
        this.my_input.registerNextAction(() => this.toggle_pause());

        // 地面の生成
        this.ground = this.create_ground(this.scene);

        // オブジェクト生成クラスの生成
        GameState.spawn = new Spawn(this.scene);
        GameState.spawn_scheduler = new SpawnScheduler(this.scene, GameState.spawn);

        // 実行クラスの生成
        this.exec = new Exec(this.scene);

        // ワイプの生成
        this.wipe = new Wipe(scene, GameState.camera);
    }

    create_ground(scene){
            const xMin = -70, xMax = 70;
            const zMin = 0, zMax = 50;
            const subdivisions = 30; // 格子の分割数（多いほど細かい）

            const width  = xMax - xMin;  // 20
            const depth  = zMax - zMin;  // 30

            // ベースのGroundメッシュを生成
            const ground = BABYLON.MeshBuilder.CreateGround("seaFloor", {
                width:  width,
                height: depth,
                subdivisions: subdivisions,
                updatable: true
            }, scene);

            // 中心をずらす（CreateGroundは原点中心なので）
            const centerX = (xMin + xMax) / 2;  // 0
            const centerZ = (zMin + zMax) / 2;  // 5
            ground.position.x = centerX;
            ground.position.z = centerZ;

            // 頂点データを取得してY座標を書き換える
            const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);

            for (let i = 0; i < positions.length; i += 3) {
                // Y座標（i+1）を ランダム値に
                positions[i + 1] = -10 - Math.random() * 2.0;
            }

            ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);

            // 法線を再計算（ライティングを正しくするため）
            ground.createNormals(true);

            // マテリアル（青白い色）
            const mat = new BABYLON.PBRMaterial("seaFloorMat", scene);
            mat.albedoColor  = new BABYLON.Color3(0.6, 0.8, 1.0);
            // mat.emissiveColor  = new BABYLON.Color3(0.6, 0.8, 1.0);
            mat.metallic = 0.2;
            mat.roughness = 1.0;
            mat.alpha = 0.5;
            mat.wireframe = false;  // trueにするとワイヤーフレーム確認できる
            ground.material = mat;
        return ground;
    }

    update(time, delta){
        // if (!this.isInitialized){
        //     console.log("not initialized");
        //     return;
        // } 
        // console.log("GameState.stage_state:", GameState.stage_state);

        // 開始時・終了後での GameState.asset.se などのアクセスを防ぐ
        if (!GameState.asset) return;

        const delta_sec = delta / 1000;

        // ■ステージステータスによる状態遷移
        if (GameState.stage_state === GLOBALS.STAGE_STATE.START){
            // ◆開始（ステージの初期化処理）
            // 精霊の初期配置
            GameState.spawn_scheduler.initial_placement();
            // [STATUS_MSG]
            GameState.ui_manager.show_status_message(`GET READY`);
            // [WIPE]
            this.wipe.wipe_in(3000);
            // [TRANSIT]
            this.stage_state_count = 2.5;
            GameState.stage_state = GLOBALS.STAGE_STATE.STARTING;
        } else if (GameState.stage_state === GLOBALS.STAGE_STATE.STARTING){
            // ◆開始期間
            // [COUNTER]
            this.stage_state_count -= delta_sec;
            if (this.stage_state_count < 0){
                GameState.stage_state = GLOBALS.STAGE_STATE.PLAYING;
                // [STATUS_MSG]
                GameState.ui_manager.hide_status_message();
            }
        } else if (GameState.stage_state === GLOBALS.STAGE_STATE.PLAYING){
            // ◆プレイ中
            GameState.elapsed_time += delta;
        } else if (GameState.stage_state === GLOBALS.STAGE_STATE.FAIL){
            // ◆失敗
            // [STATUS_MSG]
            GameState.ui_manager.show_status_message(`GAME OVER`,"#ff0000");
            // [WIPE]
            this.wipe.wipe_out(4000);
            // [TRANSIT]
            this.stage_state_count = 4;
            GameState.stage_state = GLOBALS.STAGE_STATE.FAILED;
        } else if (GameState.stage_state === GLOBALS.STAGE_STATE.FAILED){
            // ◆失敗期間
            // [COUNTER]
            this.stage_state_count -= delta_sec;
            if (this.stage_state_count < 0){
                // [TRANSIT]
                this.game.sceneManager.changeScene(new GameOverScene(this.game));
            }
        } else if (GameState.stage_state === GLOBALS.STAGE_STATE.CLEAR){
            // ◆ステージクリア

            // [STATUS_MSG]
            GameState.ui_manager.show_status_message(`ALL CLEAR`,"#ff8020");
            // [SOUND]
            GameState.asset.jingle.stageclear.play(false);
            // [TRANSIT]
            GameState.stage_state = GLOBALS.STAGE_STATE.ALL_CLEARED;
            this.stage_state_count = 4;
            // [WIPE]
            this.wipe.wipe_out(4000);

        } else if (GameState.stage_state === GLOBALS.STAGE_STATE.ALL_CLEARED){
            // ◆全面クリア期間
            // [COUNTER]
            this.stage_state_count -= delta_sec;
            if (this.stage_state_count < 0){
                GameState.stage++; // [ALL]
                // [TRANSIT]
                this.game.sceneManager.changeScene(new GameClearScene(this.game));
            }
        } else if (GameState.stage_state === GLOBALS.STAGE_STATE.PAUSE){
            // ◆一時停止期間
        }

        // ■ ゲームロジックの実行
        if (GameState.stage_state !== GLOBALS.STAGE_STATE.PAUSE){
            if (this.exec){
                this.exec.update(time, delta);
            }
            if (this.my_input){
                this.my_input.update(time, delta);
            }
        }

        // ■ UIの表示更新
        if (GameState.ui_manager){
            GameState.ui_manager.update(time, delta);
        }

        // ■ ライト
        if (this.sunLight){
            this.update_sunLight(time, delta);
        }

        // ■ 隠しキー
        if (GameState.inputKey && GameState.inputKey["q"]){
            this.game.sceneManager.changeScene(new TitleScene(this.game));
        }
        if (GameState.inputKey && GameState.inputKey["o"]){
            this.game.sceneManager.changeScene(new GameOverScene(this.game));
        }
        if (GameState.inputKey && GameState.inputKey["c"]){
            this.calculate_result();
            this.game.sceneManager.changeScene(new GameClearScene(this.game));
        }

        super.update();
    } // End of update()

    getTimedColorToRef(table, t, out) {
        const len = table.length;
        let a = table[0], b = table[len - 1];

        for (let i = 0; i < len - 1; i++) {
            if (t >= table[i].t && t < table[i+1].t) {
                a = table[i];
                b = table[i+1];
                break;
            }
        }

        const f = (t - a.t) / (b.t - a.t);
        out.r = a.r + (b.r - a.r) * f;
        out.g = a.g + (b.g - a.g) * f;
        out.b = a.b + (b.b - a.b) * f;
        out.i = a.i + (b.i - a.i) * f;
    }

    update_sunLight(time, delta){
        this.timeOfDay = (this.timeOfDay + delta / 1000 * this.DAY_SPEED) % 1.0;
        const angle = this.timeOfDay * Math.PI * 2;

        // 太陽の方向ベクトルを更新（Y軸周りに回転）
        this.tmp_sunLightDirection.set(Math.cos(angle), -Math.sin(angle), 0.3);
        this.tmp_sunLightDirection.normalize();
        this.sunLight.direction.copyFrom(this.tmp_sunLightDirection);

        // 太陽光
        this.getTimedColorToRef(this.sunLight_colors, this.timeOfDay, this.tmp_timedColor);
        this.sunLight.diffuse.set(this.tmp_timedColor.r, this.tmp_timedColor.g, this.tmp_timedColor.b);
        this.fluctuation = (this.fluctuation + delta / 10 * this.FLUCTUATION_SPEED) % 1.0;
        this.sunLight.intensity = this.tmp_timedColor.i * (0.7 + Math.sin(this.fluctuation * Math.PI * 2) * 0.3);

        // 背景色
        this.getTimedColorToRef(this.background_colors, this.timeOfDay, this.tmp_timedColor);
        this.scene.clearColor.set(this.tmp_timedColor.r, this.tmp_timedColor.g, this.tmp_timedColor.b);
        this.scene.fogColor.set(this.tmp_timedColor.r, this.tmp_timedColor.g, this.tmp_timedColor.b);
    }

    // ポーズ処理
    toggle_pause(){
        if (GameState.stage_state === GLOBALS.STAGE_STATE.PLAYING){
            // [SOUND]
            // GameState.bgm.pause();
            // [STATUS_MSG]
            GameState.ui_manager.show_status_message(`PAUSE`);
            // [TRANSIT]
            GameState.stage_state = GLOBALS.STAGE_STATE.PAUSE;
            // console.log("pause");
        } else if ( GameState.stage_state === GLOBALS.STAGE_STATE.PAUSE){
            // [SOUND]
            // GameState.bgm.resume();
            // [STATUS_MSG]
            GameState.ui_manager.hide_status_message();
            // [TRANSIT]
            GameState.stage_state = GLOBALS.STAGE_STATE.PLAYING;
            // console.log("resume");
        }
    }

    dispose() {
        if (GameState.asset){
            GameState.asset.dispose();
            GameState.asset = null;
        }

        if (this.my_input){
            this.my_input.dispose();
            this.my_input = null;
        }

        if (GameState.ui_manager){
            GameState.ui_manager.dispose();
            GameState.ui_manager = null;
        }

        if (GameState.camera){
            GameState.camera.dispose();
            GameState.camera = null;
        }

        if (GameState.spawn){
            GameState.spawn.dispose();
            GameState.spawn = null;
        }

        if (GameState.spawn_scheduler){
            GameState.spawn_scheduler.dispose();
            GameState.spawn_scheduler = null;
        }

        if (this.ground){
            this.ground.dispose();
            this.ground = null;
        }

        super.dispose();
    }
}
