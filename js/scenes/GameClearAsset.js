// GameClearAsset.js
import { Asset } from './base_asset.js';
import { MyAudio } from "../utils/AudioUtils.js"

export class GameClearAsset extends Asset {
    constructor(scene) {
        super(scene);
    }

    async preload(){
        // ユーザ操作後にオーディオ初期化
        await MyAudio.initialize();

        // this.bgm.epilogue = await MyAudio.load( "./assets/audio/bgm/bgm_epilogue.mp3");
        // this.bgm.epilogue.setVolume(0.7);
    }

    dispose(){
        super.dispose();
    }
}