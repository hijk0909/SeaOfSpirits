// base_attachment.js

export class Attachment {
    constructor(spirit, socket){
        this.spirit = spirit;
        this.scene = spirit.scene;
        this.parent = spirit.mesh;
        this.socket = socket;
        this.nodes = [];
    }

    create_root(socket, offset = 0.0) {
        const root = new BABYLON.TransformNode('Attachment_Root', this.scene);
        root.parent = this.parent;

        const normal = socket.normal.normalize();
        root.position.copyFrom(socket.position);
        this.shift_position(root.position, normal, offset);

        // socket.normal の方向に root のローカル Z 軸を向ける
        const up = Math.abs(BABYLON.Vector3.Dot(normal, BABYLON.Vector3.Up())) < 0.99
            ? BABYLON.Vector3.Up()
            : BABYLON.Vector3.Right();
        const rotMat = BABYLON.Matrix.LookAtLH(
            BABYLON.Vector3.Zero(),
            normal.scale(-1),  // LookAtLH は -Z 方向を向くので反転
            up
        ).invert();
        root.rotationQuaternion = BABYLON.Quaternion.FromRotationMatrix(rotMat);

        this.nodes.push(root);
        return root;
    }

    shift_position(pos, normal, offset){
        if (offset !== 0.0){
            pos.addInPlace(normal.scale(-offset));
        }
    }

    setEnabled(enable){
         for (const attachment of this.nodes){
            attachment.setEnabled(enable);
        }
    }

    update(time,delta){
    }

    dispose(){
        // root.dispose(false, true) でアタッチメントも全部消えるので以下は不要
        // nodes は可視化制御（setEnabled) で必要なので削らないこと
        /*
        for (const attachment of this.nodes){
            if (!attachment.isDisposed()){
                // 第一引数 doNotRecurse 第二引数 disposeMaterialAndTextures
                attachment.dispose(true, true);
            }
        }
        */
        this.nodes = null;
    }
}