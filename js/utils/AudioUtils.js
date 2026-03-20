// AudioUtil.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from '../GameState.js';
import { MyMath } from './MathUtils.js';

export class MyAudio {

    audioContext = null;
    initialized = false;
    
    // 初期化（ユーザー操作後に1回呼ぶ）
    static async initialize() {
      if (this.initialized) return;
      
      // Babylon.jsのAudioEngineを使用
      if (!BABYLON.Engine.audioEngine) {
        BABYLON.Engine.audioEngine = new BABYLON.AudioEngine();
      }
      
      if (!BABYLON.Engine.audioEngine.unlocked) {
        BABYLON.Engine.audioEngine.unlock();
      }
      
      this.audioContext = BABYLON.Engine.audioEngine.audioContext;
      
      // AudioContextが確実に起動するまで待つ
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.initialized = true;
      // console.log("MyAudio initialized");
    }
    
    // 音声ファイルを読み込む
    static async load(url) {
      if (!this.initialized) {
        console.log("not initalized");
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        console.log(`READ FILE FAILED: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      return new SoundInstance(this.audioContext, audioBuffer);
    }
}
  
// 個別の音声インスタンス
class SoundInstance {
    constructor(audioContext, audioBuffer) {
        this.audioContext = audioContext;
        this.audioBuffer = audioBuffer;
        this.source = null;
        this.gainNode = null;
        this.leftGainNode = null;
        this.rightGainNode = null;
        this.isPlaying = false;
        this.isLooping = false;
        this.volume = 1.0;
        this.hasPan = false;
        this.pan = 0; // -1(左) ~ 0(中央) ~ +1(右)

        // 一時停止・再開用
        this.pausedAt = 0;
        this.startedAt = 0;
        this.playbackOffset = 0;

        // イベントハンドラ
        this.onStarted = null;
        this.onEnded = null;
        this.onPaused = null;
        this.onResumed = null;
    }
    
    play(loop = false) {
        // 既に再生中なら停止
        if (this.isPlaying) {
            this.stop();
        }

        // 一時停止からの再開ではない場合、オフセットをリセット
        if (!this.isPaused) {   
          this.playbackOffset = 0;
        }

        // 新しいソースを作成
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.loop = loop;
        this.isLooping = loop;
        
        // 音量ノード
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.volume;

        if (this.hasPan){
            // パン用の左右ゲインノード
            this.leftGainNode = this.audioContext.createGain();
            this.rightGainNode = this.audioContext.createGain();
            this._updatePanGains();

            // ステレオマージャー
            this.merger = this.audioContext.createChannelMerger(2);
            
            // 接続: source → gain → left/right gains → merger → destination
            this.source.connect(this.gainNode);
            this.gainNode.connect(this.leftGainNode);
            this.gainNode.connect(this.rightGainNode);
            this.leftGainNode.connect(this.merger, 0, 0);  // 左チャンネル
            this.rightGainNode.connect(this.merger, 0, 1); // 右チャンネル
            this.merger.connect(this.audioContext.destination);
        } else {
            this.source.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);
        }
        
        // 終了イベント
        this.source.onended = () => {
            if (!this.isLooping) {
                this.isPlaying = false;
                if (this.onEnded) this.onEnded();
            }
        };
      
        // 再生開始（オフセット位置から）
        this.startedAt = this.audioContext.currentTime;
        this.source.start(0, this.playbackOffset);
        this.isPlaying = true;
        this.isPaused = false;
        
        if (this.onStarted) this.onStarted();
    }
    
    stop() {
        if (this.source && this.isPlaying) {
            try {
            this.source.stop();
            } catch (e) {
            // 既に停止している場合のエラーを無視
            }
            this.isPlaying = false;
        }
    }

    // 一時停止
    pause() {
        if (!this.isPlaying || this.isPaused) return;
        
        // 現在の再生位置を計算
        const elapsed = this.audioContext.currentTime - this.startedAt;
        this.playbackOffset += elapsed;
        
        // ループの場合、バッファの長さで剰余を取る
        if (this.isLooping) {
            this.playbackOffset = this.playbackOffset % this.audioBuffer.duration;
        }
        
        // ソースを停止
        if (this.source) {
            this.source.stop();
            this.source.disconnect();
        }
        
        this.isPaused = true;
        this.isPlaying = false;
        
        if (this.onPaused) this.onPaused();
    }
    
    // 再開
    resume() {
        if (!this.isPaused) return;
        
        this.play(this.isLooping);
        
        if (this.onResumed) this.onResumed();
    }
    

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
    }
    
    getDuration() {
        return this.audioBuffer.duration;
    }

    // フェードアウト
    fadeOut(duration = 1.0) {
        if (!this.gainNode || !this.isPlaying) return;
        
        const currentTime = this.audioContext.currentTime;
        const currentVolume = this.gainNode.gain.value;
        
        // 現在の音量から0まで線形に減少
        this.gainNode.gain.cancelScheduledValues(currentTime);
        this.gainNode.gain.setValueAtTime(currentVolume, currentTime);
        this.gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);
        
        // フェードアウト完了後に停止
        setTimeout(() => {
        this.stop();
        // 音量を元に戻す
        this.volume = currentVolume;
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
        }, duration * 1000);
    }
  
    // フェードイン（再生開始時に使用）
    fadeIn(duration = 1.0) {
        if (!this.gainNode) return;
        
        const currentTime = this.audioContext.currentTime;
        const targetVolume = this.volume;
        
        // 0から目標音量まで線形に増加
        this.gainNode.gain.cancelScheduledValues(currentTime);
        this.gainNode.gain.setValueAtTime(0, currentTime);
        this.gainNode.gain.linearRampToValueAtTime(targetVolume, currentTime + duration);
    }

    // パン値に基づいて左右のゲインを計算
    _updatePanGains() {
        if (!this.leftGainNode || !this.rightGainNode) return;
        
        // Equal Power Panning法を使用
        // pan = -1 (左): left=1, right=0
        // pan =  0 (中央): left=0.707, right=0.707
        // pan = +1 (右): left=0, right=1
        const panRad = (this.pan + 1) * Math.PI / 4; // -1~1 を 0~π/2 にマッピング
        this.leftGainNode.gain.value = Math.cos(panRad);
        this.rightGainNode.gain.value = Math.sin(panRad);
    }
  
    // 現在の再生位置を取得（秒）
    getCurrentTime() {
        if (!this.isPlaying) {
        return this.isPaused ? this.playbackOffset : 0;
        }
        
        const elapsed = this.audioContext.currentTime - this.startedAt;
        let currentTime = this.playbackOffset + elapsed;
        
        // ループの場合、バッファの長さで剰余を取る
        if (this.isLooping) {
        currentTime = currentTime % this.audioBuffer.duration;
        }
        
        return currentTime;
    }
  
    // 合計の長さを取得（秒）
    getDuration() {
        return this.audioBuffer.duration;
    }
  
    // 特定の位置から再生
    playFrom(time) {
        this.playbackOffset = Math.max(0, Math.min(time, this.audioBuffer.duration));
        this.play(this.isLooping);
    }

    // 定位（パン）設定: -1(左) ~ 0(中央) ~ +1(右)
    setPan(pan) {
        this.hasPan = true;
        this.pan = Math.max(-1, Math.min(1, pan));
        if (this.panNode) {
            this.panNode.pan.value = this.pan;
            console.log("AudioUtil.setPan",this.pan);
        }
    }

    // 3D定位つきSE再生
    play_3D(pos, scene){
        if (this.isPlaying) { this.stop(); }
        const PAN_RANGE = 2.0;
        // 3D → スクリーン座標
        const screen_pos = MyMath.world_to_screen(pos);
        const renderWidth = GameState.game.engine.getRenderWidth();
        const normalizedX = ((screen_pos.x / renderWidth) - 0.5) * PAN_RANGE;
        const clampedX = Math.max(-1, Math.min(1, normalizedX));
        // console.log("play_3D screen_pos.x:", screen_pos.x, " normalizedX:", normalizedX, " clampedX:",clampedX);
        this.setPan(clampedX);

        const dist = BABYLON.Vector3.Distance(GameState.camera.position, pos);
        const far = 15.0;
        const volume = Math.max(0, 1 - dist / far);
        this.setVolume(volume);
        this.play(false);
    }


    dispose(){
        this.stop();
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        this.audioBuffer = null;
        // this.audioContext = null;
    }
}

// ファイルから直接、音声再生用のデータをでコードするテスト用関数
function load_asset(){
        const assetsManager = new BABYLON.AssetsManager(this.scene);
        const soundTask = assetsManager.addBinaryFileTask(
            "sound task", 
            "./assets/audio/se/se_powerup.mp3"
        );
        assetsManager.onFinish = (tasks) => {
                const soundData = soundTask.data;
                this.engine.audioEngine.audioContext.decodeAudioData(
                soundData,
                // 成功コールバック
                (audioBuffer) => {
                    console.log("SUCCESS: Raw decode successful! Buffer duration:", audioBuffer.duration);
                    // デコードが成功すれば、この audioBuffer を使って Sound を作成できます
                    // 例: new BABYLON.Sound("dummy", audioBuffer, this.scene, ...);
                },
                // エラーコールバック
                (error) => {
                    console.error("ERROR: Raw decode FAILED!", error);
                }
            );
        }
        assetsManager.load();
}