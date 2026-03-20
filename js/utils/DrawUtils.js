// DrawUtils.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from '../GameState.js';
import { MyMath } from './MathUtils.js';

export class Wipe {
    constructor(scene, camera) {
        this.scene = scene;
        const engine = scene.getEngine();

        // ポストプロセスの作成
        this.postProcess = new BABYLON.PostProcess(
            "WipeProcess", 
            "wipe", // ShadersStoreの接頭辞
            ["center", "radius", "alpha", "aspectRatio"], // Uniforms
            null, 
            1.0, 
            camera
        );

        // 初期パラメータ
        this.params = {
            radius: 0.0,
            alpha: 0.0,
            center: new BABYLON.Vector2(0.5, 0.5)
        };

        this.postProcess.onApply = (effect) => {
            effect.setVector2("center", this.params.center);
            effect.setFloat("radius", this.params.radius);
            effect.setFloat("alpha", this.params.alpha);
            effect.setFloat("aspectRatio", engine.getRenderWidth() / engine.getRenderHeight());
        };
    }

    wipe_in(duration = 3000) {
        this.params.alpha = 1.0;
        let startTime = performance.now();
        
        const observer = this.scene.onBeforeRenderObservable.add(() => {
            let progress = Math.min((performance.now() - startTime) / duration, 1);
            // 0から1.5くらいまで広げる（画面全体を覆うため）
            this.params.radius = progress * 1.2; 

            if (progress >= 1) {
                this.scene.onBeforeRenderObservable.remove(observer);
                this.params.alpha = 0.0; // 完全に終わったら効果を消す
            }
        });
    }

    wipe_out(duration = 2000) {
        let startTime = performance.now();
        const observer = this.scene.onBeforeRenderObservable.add(() => {
            let elapsed = performance.now() - startTime;
            let progress = Math.min(elapsed / duration, 1);
            
            this.params.radius = 1.2 * (1 - progress);
            this.params.alpha = Math.min(elapsed / 500, 1.0); // チラつき防止のフェードイン

            if (progress >= 1) {
                this.scene.onBeforeRenderObservable.remove(observer);
            }
        });
    }
}

const TYPE_INTERVAL = 40; // ms / 1文字
const LINE_INTERVAL = 600;

export class ScrollText {
    constructor(ui, scene){
        this.ui = ui;
        this.scene = scene;
        this.panel = null;
        this.active_text_blocks = [];
        this._stopped = false;

        this.create();
    }

    create(){
        const panel = new BABYLON.GUI.StackPanel();
        panel.width = "80%";
        panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        panel.top = "0px";
        this.ui.addControl(panel);
        this.panel = panel;
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async play(lines, callback1 = null, callback2 = null, delayAfter = 5000) {
        if (!this.panel) return;
        this._stopped = false;
        this.callback1 = callback1;
        this.callback2 = callback2;

        for (const line of lines) {
            if (this._stopped) break;
            const tb = new BABYLON.GUI.TextBlock();
            tb.text = "";
            tb.color = "white";
            tb.fontSize = 48;
            tb.textWrapping = true;
            tb.height = "70px";
            tb.paddingBottom = "12px";
            tb.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

            this.panel.addControl(tb);
            this.active_text_blocks.push(tb);

            for (let i = 0; i <= line.length; i++) {
                if (this._stopped) break;
                tb.text = line.slice(0, i);
                await this.wait(TYPE_INTERVAL);
            }

            await this.wait(LINE_INTERVAL);
        }
        if (this.callback1) this.callback1();
        await this.wait(delayAfter);
        if (this.callback2) this.callback2();
    }

    stop() {
        this._stopped = true;
        this.callback1 = null;
        this.callback2 = null;
    }

    dispose() {
        this.panel.dispose();
        for (const tb of this.active_text_blocks){
            tb.dispose();
        }
    }
} // End of class ScrollText


const MSG_TYPE_INTERVAL  =  60;   // 1文字ずつ表示する間隔 (ms)
const MSG_LINE_INTERVAL  = 400;   // 1行表示完了後、次行開始までの待機時間 (ms)
const CURSOR_BLINK_INTERVAL = 100;   // カーソル点滅の切替間隔 (ms)
const FADE_START     = 2500;  // テキストブロックが登録されてからフェードアウト開始するまでの時間 (ms)
const FADE_DURATION  = 1500;  // フェードアウトに掛かる時間 (ms)

const STATE_IDLE    = "IDLE";    // キューが空、何もしていない
const STATE_TYPING  = "TYPING";  // 1文字ずつタイプ中
const STATE_WAITING = "WAITING"; // 1行完了後、次行開始まで待機中

export class ScrollMessage {

    constructor(ui, scene) {
        this.ui    = ui;
        this.scene = scene;
        this.panel = null;

        // { tb: TextBlock, registeredAt: number } の配列
        // registeredAt は タイプ完了時刻を記録
        this.text_blocks = [];

        // 表示待ちテキストのキュー: { text: string, color: string }[]
        this._queue = [];

        // タイプ中の状態
        this._state         = STATE_IDLE;
        this._currentText   = "";   // 今タイプしている文字列全体
        this._currentColor  = "#ffffff";
        this._charIndex     = 0;    // 次に表示する文字のインデックス
        this._currentTB     = null; // タイプ中の TextBlock
        this._typeTimer     = 0;    // TYPE_INTERVAL のカウンタ
        this._waitTimer     = 0;    // LINE_INTERVAL のカウンタ

        // カーソル点滅
        this._blinkTimer    = 0;
        this._cursorVisible = true; // true: "_"  false: " "

        this.create();
    }

    create() {
        const panel = new BABYLON.GUI.StackPanel();
        panel.width               = "80%";
        panel.verticalAlignment   = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.left = "600px";
        panel.top  = "-120px";
        this.ui.addControl(panel);
        this.panel = panel;
    }

    add_texts(texts, color) {
        for (const text of texts) {
            this._queue.push({ text, color });
        }
        // IDLE だったらすぐ次の行を開始
        if (this._state === STATE_IDLE) {
            this._startNextLine();
        }
    }

    update(time, delta) {

        // カーソル点滅
        if (this._state !== STATE_IDLE) {
            this._blinkTimer += delta;
            if (this._blinkTimer >= CURSOR_BLINK_INTERVAL) {
                this._blinkTimer  -= CURSOR_BLINK_INTERVAL;
                this._cursorVisible = !this._cursorVisible;
                // 現在タイプ中 / 待機中の TextBlock のカーソルを更新
                if (this._currentTB) {
                    this._refreshCurrentTBText();
                }
            }
        }

        // タイプ処理
        if (this._state === STATE_TYPING) {
            this._typeTimer += delta;
            while (this._typeTimer >= MSG_TYPE_INTERVAL) {
                this._typeTimer -= MSG_TYPE_INTERVAL;
                this._stepType(time);
                if (this._state !== STATE_TYPING) break; // 行末到達で状態変化
            }
        }

        // 行間待機
        if (this._state === STATE_WAITING) {
            this._waitTimer += delta;
            if (this._waitTimer >= MSG_LINE_INTERVAL) {
                this._waitTimer = 0;
                // カーソルを消して行を確定
                if (this._currentTB) {
                    this._currentTB.text = this._currentText; // カーソルなし
                    this._currentTB      = null;
                }
                this._startNextLine();
            }
        }

        // フェードアウト処理
        for (let i = this.text_blocks.length - 1; i >= 0; i--) {
            const entry   = this.text_blocks[i];
            const elapsed = time - entry.registeredAt;

            if (elapsed >= FADE_START + FADE_DURATION) {
                // 完全に透明 → 破棄
                entry.tb.dispose();
                this.text_blocks.splice(i, 1);
            } else if (elapsed >= FADE_START) {
                // フェード中
                const ratio   = (elapsed - FADE_START) / FADE_DURATION; // 0→1
                entry.tb.alpha = Math.max(0, 1 - ratio);
            }
        }
    }

    dispose() {
        for (const entry of this.text_blocks) {
            entry.tb.dispose();
        }
        this.text_blocks = [];
        if (this.panel) {
            this.panel.dispose();
            this.panel = null;
        }
    }

    //  private helpers
    // キューから次の行を取り出してタイプを開始
    _startNextLine() {
        if (this._queue.length === 0) {
            this._state      = STATE_IDLE;
            this._currentTB  = null;
            return;
        }

        const { text, color } = this._queue.shift();
        this._currentText  = text;
        this._currentColor = color;
        this._charIndex    = 0;
        this._typeTimer    = 0;
        this._blinkTimer   = 0;
        this._cursorVisible = true;
        this._state        = STATE_TYPING;

        // 新しい TextBlock を作成（最初は空＋カーソル）
        const tb       = new BABYLON.GUI.TextBlock();
        tb.text        = this._cursorChar();
        tb.color       = color;
        tb.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        tb.resizeToFit = true;
        tb.fontSize = 48;
        tb.textWrapping = true;
        tb.height = "70px";
        tb.paddingTop  = "2px";
        tb.paddingBottom = "12px";

        this.panel.addControl(tb);
        this._currentTB = tb;
    }

    // 1文字分タイプを進める
    _stepType(time) {
        if (this._charIndex >= this._currentText.length) {
            // 行末 → 待機状態へ
            this._state     = STATE_WAITING;
            this._waitTimer = 0;
            // 完了した TextBlock を text_blocks へ登録
            this.text_blocks.push({
                tb:           this._currentTB,
                registeredAt: time
            });
            this._refreshCurrentTBText(); // 待機中もカーソルは点滅させる
            return;
        }

        this._charIndex++;
        this._refreshCurrentTBText();
    }

    // _currentTB の表示テキストをカーソル込みで更新
    _refreshCurrentTBText() {
        if (!this._currentTB) return;
        const typed  = this._currentText.slice(0, this._charIndex);
        const cursor = (this._state === STATE_IDLE) ? "" : this._cursorChar();
        this._currentTB.text = typed + cursor;
    }

    // 現在の点滅状態に応じたカーソル文字を返す
    _cursorChar() {
        return this._cursorVisible ? "_" : " ";
    }
} // End of ScrollMessage

const PADDING = 100;

export class MyDraw {

    static set_text_center(tobj, offset_x = 0, offset_y = 0){
        tobj.resizeToFit = true;
        tobj.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        tobj.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        tobj.alpha = 0.0;
        tobj._markAsDirty();

        tobj.onAfterDrawObservable.addOnce(() => {
            const iw = GLOBALS.UI.WIDTH;
            const ih = GLOBALS.UI.HEIGHT;
            const tw = tobj.widthInPixels;
            const th = tobj.heightInPixels;
            const org_left = iw /2 - tw /2 + offset_x;
            const org_top = ih /2 - th /2 + offset_y;
            const {left, top} = MyMath.clamp_ui_object(org_left, org_top, PADDING, PADDING, tw, th);
            tobj.left = left;
            tobj.top = top;
            tobj.alpha = 1.0;
            // console.log("MyDraw.set_text_center 2:",iw, ih, tw, th, x, y);
        });
    }

    static set_text_position(tobj, x, y){
        tobj.resizeToFit = true;
        tobj.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        tobj.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        tobj.alpha = 0.0;
        tobj._markAsDirty();

        tobj.onAfterDrawObservable.addOnce(() => {
            const tw = tobj.widthInPixels;
            const th = tobj.heightInPixels;
            const org_left = x - tw /2;
            const org_top = y - th /2;
            const {left, top} = MyMath.clamp_ui_object(org_left, org_top, PADDING, PADDING, tw, th);
            tobj.left = left;
            tobj.top = tobj.top_base = top;
            tobj.alpha = 1.0;
        });
    }

    static link_text(tobj, mesh, scene, offsetY = 0, alpha = 1.0){
        const screen_pos = MyMath.world_to_screen(mesh.position);
        if (screen_pos.z < 0.5 || screen_pos.z > 1.0){
            tobj.alpha = 0.0;
        } else if ( MyMath.is_occluded_by_terrain(mesh.position, scene)){
            tobj.alpha = 0.0;
        } else {
            tobj.alpha = alpha;
            const tw = tobj.widthInPixels;
            const th = tobj.heightInPixels;
            tobj.left = screen_pos.x - tw /2;
            tobj.top = screen_pos.y - th/ 2 + offsetY;
            // const {left, top} = MyMath.clamp_ui_object(screen_pos.x - tw / 2, screen_pos.y - th/2, PADDING, PADDING, tw, th);
            // tobj.left = left;
            // tobj.top = top;
            // console.log("left,top:", tobj.left, tobj.top);
        }
    }

    static show_scroll_message_once(texts, color, flag) {
        if (!GameState.scroll_message_flags.has(flag)) {
            GameState.scroll_message_flags.add(flag);
            GameState.ui_manager.add_scroll_messages(texts, color);
        }
    }
}