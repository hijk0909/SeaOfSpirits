// base_thinManager.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";

const ZERO_SCALE    = new BABYLON.Vector3(0, 0, 0);
const ZERO_POSITION = new BABYLON.Vector3(0, 0, 0);
const IDENTITY_QUAT = BABYLON.Quaternion.Identity();

export class ThinManager {
    constructor(max_num){
        this.max_num = max_num;
        this.matrixBuffer = new Float32Array(max_num * 16);
        this.colorBuffer  = new Float32Array(max_num * 4);        

        this.freeList = []; //空き番管理用
        for (let i = max_num-1; i >= 0; i--) { this.freeList.push(i) };

        this.mesh = null;
        this._create_mesh()
        this.mesh.thinInstanceSetBuffer("matrix", this.matrixBuffer, 16, false);
        this.mesh.thinInstanceSetBuffer("color",  this.colorBuffer,   4, false);

        this.tmp_matrix   = new BABYLON.Matrix();
    }

    _create_mesh(){
        // 継承先でオーバーライド
    }

    register_instance(){    
        if (this.freeList.length === 0){ console.log("no instance left"); return null;}
        return this.freeList.pop();
    }

    unregister_instance(index){
        if (index === null) return;
        this.set_matrix(index, ZERO_SCALE, ZERO_POSITION, IDENTITY_QUAT);
        this.freeList.push(index);
    }

    set_matrix(index, scale, position = ZERO_POSITION, rotation = IDENTITY_QUAT){
        if (index === null) return;
        const quat = rotation ?? IDENTITY_QUAT;
        BABYLON.Matrix.ComposeToRef(
            scale,
            quat,
            position,
            this.tmp_matrix
        );
        this.tmp_matrix.copyToArray(this.matrixBuffer, index * 16);

        this.matrixDirty = true;
    }

    set_position(index, position){
        if (index === null) return;
        const offset = index * 16;
        this.matrixBuffer[offset + 12] = position.x;
        this.matrixBuffer[offset + 13] = position.y;
        this.matrixBuffer[offset + 14] = position.z;

        this.matrixDirty = true;
    }

    set_color(index, color){
        if (index === null) return;
        const offset = index * 4;
        this.colorBuffer[offset + 0] = color.r;
        this.colorBuffer[offset + 1] = color.g;
        this.colorBuffer[offset + 2] = color.b;
        this.colorBuffer[offset + 3] = color.a ?? 1.0;

        this.colorDirty = true;
    }

    update(time, delta){
        if (this.matrixDirty){
            this.mesh.thinInstanceBufferUpdated("matrix");
            this.matrixDirty = false;
        }
        if (this.colorDirty){
            this.mesh.thinInstanceBufferUpdated("color");
            this.colorDirty = false;
        }
    }

    dispose(){
        if (this.mesh){
            this.mesh.dispose();
            this.mesh = null;
        }
        if (this.matrixBuffer){
            this.matrixBuffer.length = 0;
            this.matrixBuffer = null;
        }
        if (this.colorBuffer){
            this.colorBuffer.length = 0;
            this.colorBuffer = null;
        }
    }
}
