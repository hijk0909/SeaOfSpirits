// base_scene.js
export class Scene {

    constructor(game){
        this.game = game;
        this.scene = new BABYLON.Scene(game.engine);
    }

    async initialize(){
        this.setup();
        // console.log("Base_scene:setuped");
        await this.preload();
        // console.log("Base_scene:preloaded");
        this.create();
        // console.log("Base_scene:created");
        this.compile();
    }

    compile() {
        this.scene.executeWhenReady(() => {
            // カメラがまだなら何もしない（次フレームで動作上は問題ない）
            if (!this.scene.activeCamera) { return;  }
            // 1フレーム描画
            this.scene.render();
            // 全メッシュを一度可視状態で通す（ウォームアップ）
            this.scene.meshes.forEach(mesh => {
                const wasEnabled = mesh.isEnabled();
                mesh.setEnabled(true);
                mesh.computeWorldMatrix(true);
                mesh.refreshBoundingInfo();
                mesh.setEnabled(wasEnabled);
            });
            // もう一度 render
            this.scene.render();
        });
    }

    // シーン開始時、preload前に実施すべきコード（カメラ生成等）
    // (Sceneを成立させる最小条件のセットアップ)
    setup(){
    }

    // アセットの読み込み
    async preload(){
    }

    create(){
    }

    update(){
    }

    dispose(){
    }
}