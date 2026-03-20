// InputUtils.js
import { GameState } from '../GameState.js';

export class MyInput {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
        this.key_observer_next = null;
        this.key_observer_confirm = null;
        this.button_observer_next = null;
        this.button_observer_confirm = null;
        this.create();
    }

    create(){
        // キーボード入力
        this.scene.actionManager = new BABYLON.ActionManager(this.scene); 
        GameState.inputKey = {};
        this.scene.onKeyboardObservable.add((kbInfo) => {
            const key = kbInfo.event.key.toLowerCase(); // 小文字で統一
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                GameState.inputKey[key] = true;
            } else if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYUP) {
                GameState.inputKey[key] = false;
            }
        });

        // マウス入力
        this.scene.onPointerDown = (evt, pickInfo) => {
            GameState.inputMouse.button = true;
            this.handleMouseEvent(evt);
        };

        // マウスムーブイベント
        this.scene.onPointerMove = (evt, pickInfo) => {
            if (GameState.inputMouse.button){
                this.handleMouseEvent(evt);
            }
        };

        // マウスアップイベント
        this.scene.onPointerUp = (evt, pickInfo) => {
            GameState.inputMouse.button = false;
        };

        // ゲームパッド更新時のアクション
        GameState.pad_manager.registerUpdateCallback(() => this.registerPadAction());
    }

    getPadInput(){
        if (!GameState.pad) return;

        const browserGamepad = GameState.pad.browserGamepad;
        if (browserGamepad) {
            // 十字キー
            GameState.inputPad.up = browserGamepad.buttons[12]?.pressed || false;
            GameState.inputPad.down = browserGamepad.buttons[13]?.pressed || false;
            GameState.inputPad.left = browserGamepad.buttons[14]?.pressed || false;
            GameState.inputPad.right = browserGamepad.buttons[15]?.pressed || false;
            
            // Aボタン
            GameState.inputPad.button = browserGamepad.buttons[0]?.pressed || false;

            // アナログスティックも考慮する場合
            const leftStickX = browserGamepad.axes[0] || 0;
            const leftStickY = browserGamepad.axes[1] || 0;
            const threshold = 0.5;

            if (Math.abs(leftStickX) > threshold) {
                GameState.inputPad.left = GameState.inputPad.left || leftStickX < -threshold;
                GameState.inputPad.right =GameState.inputPad.right || leftStickX > threshold;
            }
            if (Math.abs(leftStickY) > threshold) {
                GameState.inputPad.up = GameState.inputPad.up || leftStickY < -threshold;
                GameState.inputPad.down = GameState.inputPad.down || leftStickY > threshold;
            }
        }

        return;
    }

    handleMouseEvent(evt){
        const canvas = this.game.canvas;
        // canvas上のマウス座標を取得
        const canvasRect = canvas.getBoundingClientRect();
        GameState.inputMouse.x = evt.clientX - canvasRect.left;
        GameState.inputMouse.y = evt.clientY - canvasRect.top;
    }

    registerNextAction(callback) {
        this.callback_next = callback;
        // キーボード入力の監視
        this.key_observer_next = this.scene.onKeyboardObservable.add((kbInfo) => {
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN && kbInfo.event.code === "Space" && !kbInfo.event.repeat) {
                this.callback_next();
            }
        });
        this.registerPadNextAction();
    }

    registerConfirmAction(callback) {
        this.callback_confirm = callback;
        // キーボード入力の監視
        this.key_observer_confirm = this.scene.onKeyboardObservable.add((kbInfo) => {
            // console.log("kbinfo.event.code", kbInfo.event.code);
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN && kbInfo.event.code === "KeyZ" && !kbInfo.event.repeat) {
                this.callback_confirm();
            }
        });
        this.registerPadConfirmAction();
    }

    registerPadNextAction(){
        // console.log("registerPadNextAction:", GameState.pad, this.callback_next);
        if (GameState.pad && this.callback_next){
            this.button_observer_next = GameState.pad.onButtonDownObservable.add((button, state) => {
                if (button === 9) { // STARTボタン
                    this.callback_next();
                }
            });
        }
    }

    registerPadConfirmAction(){
        if (GameState.pad && this.callback_confirm){
            this.button_observer_confirm = GameState.pad.onButtonDownObservable.add((button, state) => {
                if (button === 0) { // Aボタン
                    this.callback_confirm();
                }
            });
        }
    }

    // Pad の 途中接続・再接続時に呼ばれ、改めて Observable を登録する
    registerPadAction(){
        this.registerPadNextAction();
        this.registerPadConfirmAction();
    }

    update() {
        this.getPadInput();
    }

    dispose(){
        if (this.key_observer_next){
            this.scene.onKeyboardObservable.remove(this.key_observer_next);
            this.key_observer_next = null;
        }
        if (this.key_observer_confirm){
            this.scene.onKeyboardObservable.remove(this.key_observer_confirm);
            this.key_observer_confirm = null;
        }
        // console.log("my_input.dispose:",GameState.pad, this.button_observer_next);
        if (GameState.pad && this.button_observer_next) {
            GameState.pad.onButtonDownObservable.remove(this.button_observer_next);
            this.button_observer_next = null;
        }
        if (GameState.pad && this.button_observer_confirm) {
            GameState.pad.onButtonDownObservable.remove(this.button_observer_confirm);
            this.button_observer_confirm = null;
        }

        // この Sceneの registerPadAction() を呼ばないようにする
        GameState.pad_manager.registerUpdateCallback(null);
    }
}


export class PadManager {
    constructor() {
        this.gamepad_manager = new BABYLON.GamepadManager();
        this.update_callback = null;
        this.create();
    }

    create(){
        GameState.pad = null;
        if (this.gamepad_manager.gamepads.length > 0) {
            GameState.pad = this.findCompatiblePad();
        }
        this.gamepad_manager.onGamepadConnectedObservable.add((gamepad) => {
            if (!GameState.pad) {
                GameState.pad = this.findCompatiblePad();
                if (GameState.pad && this.update_callback){ this.update_callback();}
            }
        });
        this.gamepad_manager.onGamepadDisconnectedObservable.add((gamepad) => {
            if (GameState.pad === gamepad) {
                GameState.pad = this.findCompatiblePad();
                if (GameState.pad && this.update_callback){ this.update_callback();}
            }
        });
    }

    findCompatiblePad() {
        const gamepads = this.gamepad_manager.gamepads;

        for (let i = 0; i < gamepads.length; i++) {
            const pad = gamepads[i];
            if (!pad || !pad.browserGamepad?.buttons) continue;

            const buttons = pad.browserGamepad.buttons;
            const hasMainButton = buttons[0] !== undefined;
            const hasStartButton = buttons[9] !== undefined;
            const hasDPad =
                buttons[12] !== undefined &&
                buttons[13] !== undefined &&
                buttons[14] !== undefined &&
                buttons[15] !== undefined;

            if (hasMainButton && hasDPad && hasStartButton) {
                console.log(`Selected Gamepad: ${pad.id}`);
                return pad;
            }
        }

        console.warn("No compatible Gamepad found.");
        return null;
    }

    registerUpdateCallback(callback){
        this.update_callback = callback;
    }
}


export class RepeatManager {
    constructor(params) {
        this.initialDelay = params.initialDelay;
        this.startInterval = params.startInterval;
        this.accel = params.accel;
        this.minInterval = params.minInterval;

        this.reset();
    }

    reset() {
        this.isPressing = false;
        this.timer = 0;
        this.interval = this.startInterval;
        this.first = true;
    }

    update(isPressed, delta) {
        if (!isPressed) {
            this.reset();
            return false;
        }

        // 押された瞬間
        if (!this.isPressing) {
            this.isPressing = true;
            this.timer = 0;
            this.interval = this.startInterval;
            this.first = true;
            return true; // 初回 即発火
        }

        this.timer += delta;

        if (this.first) {
            if (this.timer >= this.initialDelay) {
                this.timer = 0;
                this.first = false;
                return true; // リピート開始 即発火
            }
        } else {
            if (this.timer >= this.interval) {
                this.timer = 0;
                this.interval = Math.max(
                    this.minInterval,
                    this.interval - this.accel
                );
                return true; // リピート 加速発火
            }
        }

        return false;
    }
}