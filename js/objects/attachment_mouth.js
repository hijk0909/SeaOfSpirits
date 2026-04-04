// attachment_mouth.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Attachment } from "./base_attachment.js";

const DEFAULT_COLOR_LIP = new BABYLON.Color3(1.0, 0.0, 0.0);
const DEFAULT_COLOR_TOOTH = new BABYLON.Color3(1.0, 1.0, 1.0);

export class Attachment_Mouth extends Attachment{

    constructor(spirit, socket, parameters){
        super(spirit, socket);

        const { hasTeeth = true, biteSpeed = 1.0, scale = 1.0, alpha = 1.0} = parameters;
        this.hasTeeth = hasTeeth;
        this.biteSpeed = biteSpeed;

        const r = 0.5; //スケール倍率

        // テンポラリ変数
        this.tmp_rotQuat      = new BABYLON.Quaternion();
        this.tmp_finalQuat    = new BABYLON.Quaternion();
        this.tmp_offsetLocal  = new BABYLON.Vector3(0, 0, 0);
        this.tmp_fulcrumLocal = new BABYLON.Vector3(0, 0, 0);
        this.tmp_offsetRotated = new BABYLON.Vector3(0, 0, 0);
        this.tmp_fulcrumWorld  = new BABYLON.Vector3(0, 0, 0);
        this.tmp_offsetWorld   = new BABYLON.Vector3(0, 0, 0);

        // 上側・下側のrootの設定
        this.root_upper = this.create_root(socket);
        this.root_upper_rotationQuaternion_base = this.root_upper.rotationQuaternion.clone();
        this.root_upper_position_base = this.root_upper.position.clone();
        this.root_upper.scaling.set(scale * r, scale * r, scale * r);
        this.rotate_root(this.root_upper, this.root_upper_rotationQuaternion_base, this.root_upper_position_base, -45);

        this.root_lower = this.create_root(socket);
        this.root_lower_rotationQuaternion_base = this.root_lower.rotationQuaternion.clone();
        this.root_lower_position_base = this.root_lower.position.clone();
        this.root_lower.scaling.set(scale * r, scale * r, scale * r);
        this.rotate_root(this.root_lower, this.root_lower_rotationQuaternion_base, this.root_lower_position_base, +45);

        // 唇の生成
        this.create_lip(this.root_upper, parameters);
        this.create_lip(this.root_lower, parameters);

        // 歯の生成
        if (this.hasTeeth){
            this.create_teeth(this.root_upper, true, 8, parameters);
            this.create_teeth(this.root_lower, false, 8, parameters);
        }
    }

    rotate_root(root, baseQuat, basePosition, angleDeg, fulcrum=-1.0){

        const angleRad = BABYLON.Tools.ToRadians(angleDeg);
  
        //（１） 回転クォータニオン
        BABYLON.Quaternion.RotationAxisToRef(BABYLON.Axis.X, angleRad, this.tmp_rotQuat);
        this.tmp_rotQuat.multiplyToRef(baseQuat, this.tmp_finalQuat);
        root.rotationQuaternion.copyFrom(this.tmp_finalQuat);

        //（２）支点オフセット：ローカルZ軸上の fulcrum 点を回転で動かす
        //    fulcrum点からrootへのベクトル (0, 0, -fulcrum) を rotQuat で回転
        this.tmp_offsetLocal.set(0, 0, -fulcrum);
        this.tmp_offsetLocal.applyRotationQuaternionToRef(this.tmp_rotQuat, this.tmp_offsetRotated);

        //（３）ワールド座標での支点位置 = basePosition + baseQuat で回転したfulcrum方向
        //    支点はbasePositionからローカルZ方向にfulcrumずれた位置
        this.tmp_fulcrumLocal.set(0, 0, fulcrum);
        this.tmp_fulcrumLocal.applyRotationQuaternionToRef(baseQuat, this.tmp_fulcrumWorld);
        this.tmp_fulcrumWorld.addInPlace(basePosition);

        //（４）root位置 = 支点ワールド位置 + 回転後オフセット（baseQuatも考慮）
        this.tmp_offsetRotated.applyRotationQuaternionToRef(baseQuat, this.tmp_offsetWorld);
        this.tmp_offsetWorld.addInPlace(this.tmp_fulcrumWorld);
        root.position.copyFrom(this.tmp_offsetWorld);
    }

    /*
     * @param {number} R - 球の半径
     * @param {number} Z_bend - ガイド楕円のZ方向の半径
     * @param {number} R_ratio - 断面の縮小率
    */
    create_lip(root, parameters = {}) {

        const {R=2.0, R_ratio = 0.2, Z_bend = 5.0, Z_offset = 0.15, alpha = 1.0, color = DEFAULT_COLOR_LIP} = parameters;

        const sphere = BABYLON.MeshBuilder.CreateSphere("lipSphere", { diameter: R, segments: 32, updatable: true, sideOrientation: BABYLON.Mesh.FRONTSIDE }, this.scene);
        sphere.checkCollisions = false;
        sphere.isPickable = false;

        // 頂点データの取得
        const positions = sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const numberOfVertices = positions.length / 3;

        for (let i = 0; i < numberOfVertices; i++) {
            let x = positions[i * 3];
            let y = positions[i * 3 + 1];
            let z = positions[i * 3 + 2];

            // （１）ガイド楕円上のZ座標を計算し、頂点が原点(0,0,0)に来るように Z_bend を引く
            const xRatio = Math.max(-1, Math.min(1, x / R));
            const z_e = Z_bend * (Math.sqrt(1 - xRatio * xRatio) - 1.0);

            // （２）接線の角度計算
            let angle = 0;
            const z_relative = Z_bend * Math.sqrt(1 - xRatio * xRatio);
            if (z_relative !== 0) {
                const slope = -(Z_bend * Z_bend * x) / (R * R * z_relative);
                angle = Math.atan(slope);
            } else {
                angle = x > 0 ? -Math.PI / 2 : Math.PI / 2;
            }

            // （３）断面円内の相対座標（元の球の中心からのズレ）を計算
            // 元の断面はYZ平面に平行なので、中心(x, 0, 0)からのオフセットは (0, y, z)
            let localY = y * R_ratio;
            let localZ = z * R_ratio;

            // （４）回転行列を適用（Y軸周りの回転）
            // 新しい座標系での相対的な Z' = localZ * cos(angle), X' = -localZ * sin(angle)
            const newRelativeX = -localZ * Math.sin(angle);
            const newRelativeZ = localZ * Math.cos(angle);

            // （５）最終的な座標の決定
            positions[i * 3]     = x + newRelativeX;
            positions[i * 3 + 1] = localY;
            positions[i * 3 + 2] = z_e + newRelativeZ + Z_offset; // z_eがマイナス値から始まるため、手前に固定される
        }

        // メッシュの更新
        sphere.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    
        // 法線を再計算（ライティングを綺麗に）
        const normals = [];
        BABYLON.VertexData.ComputeNormals(positions, sphere.getIndices(), normals);
        sphere.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);

        // マテリアル
        const mat = new BABYLON.PBRMaterial("lipMat", this.scene);
        mat.albedoColor = color;
        mat.metallic = 0.2;
        mat.roughness = 1.0;
        mat.alpha = alpha;
        sphere.material = mat;
        
        sphere.parent = root;
        this.nodes.push(sphere);

        return sphere;
    }

    create_tooth(position, diameterBottom, height, upper, alpha=1.0, color=DEFAULT_COLOR_TOOTH) {

        let dt, db, p;
        if (!upper){
            dt = diameterBottom;
            db = 0.0;
            p =  position.add(new BABYLON.Vector3(0, -height / 2, 0));
        } else {
            dt = 0.0;
            db = diameterBottom;
            p = position.add(new BABYLON.Vector3(0, +height / 2, 0));
        }
        const mesh = BABYLON.MeshBuilder.CreateCylinder("tooth", {
            diameterTop: dt, diameterBottom: db, height: height, tessellation: 8
        }, this.scene);
        mesh.checkCollisions = false;
        mesh.isPickable = false;
        mesh.position = p;

        const mat = new BABYLON.PBRMaterial("toothMat", this.scene);
        mat.albedoColor = new BABYLON.Color3(1.0, 1.0, 1.0);
        mat.metallic = 0.2;
        mat.roughness = 1.0;
        mat.alpha = alpha;
        mesh.material = mat;

        this.nodes.push(mesh);
        return mesh;
    }

    create_teeth(root, upper, num_teeth, parameters = {}){
        const {diameterBottom=0.3, height=0.7, R=2.0, Z_bend = 5.0, Z_offset = 0.10, alpha = 1.0, color = DEFAULT_COLOR_TOOTH} = parameters;
        let startAngleDeg, endAngleDeg;
        const maxAngleDeg = 25;
        const stepAngleDeg = maxAngleDeg / (num_teeth / 2);
        if (upper){
            startAngleDeg = -maxAngleDeg;
            endAngleDeg = maxAngleDeg;
        } else {
            startAngleDeg = -maxAngleDeg + stepAngleDeg / 2;
            endAngleDeg = maxAngleDeg - stepAngleDeg / 2;
        }
        for ( let angleDeg = startAngleDeg; angleDeg <= endAngleDeg; angleDeg += stepAngleDeg){
            const angleRad = BABYLON.Tools.ToRadians(angleDeg);
            const position = new BABYLON.Vector3( R * Math.sin(angleRad), 0, Z_bend * (Math.cos(angleRad) - 1)+ Z_offset);
            const scale = ((maxAngleDeg - Math.abs(angleDeg) )/ maxAngleDeg) * 0.6 + 0.4;
            const tooth = this.create_tooth(position, diameterBottom * scale, height * scale, upper, alpha, color);
            tooth.parent = root;
        }
    }

    update(time, delta){

        const minAngleDeg=22, maxAngleDeg=39;
        let angleDeg = (maxAngleDeg - minAngleDeg) * Math.sin(time * this.biteSpeed / 200) + ((minAngleDeg + maxAngleDeg) / 2) 
        this.rotate_root(this.root_upper, this.root_upper_rotationQuaternion_base, this.root_upper_position_base, +angleDeg);
        this.rotate_root(this.root_lower, this.root_lower_rotationQuaternion_base, this.root_lower_position_base, -angleDeg);

        super.update(time, delta);
    }

    dispose(){

        super.dispose();
    }
}