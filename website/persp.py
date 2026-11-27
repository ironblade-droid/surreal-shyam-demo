import numpy as np, sys
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
def persp(pano, yaw, pitch, fov, W, H):
    P=np.asarray(pano).astype(np.float32); ph,pw=P.shape[:2]
    f=(W/2)/np.tan(np.radians(fov)/2)
    x,y=np.meshgrid(np.arange(W)-W/2+0.5, np.arange(H)-H/2+0.5)
    d=np.stack([x, -y, np.full_like(x,f)],-1); d/=np.linalg.norm(d,axis=-1,keepdims=True)
    p=np.radians(pitch); Rx=np.array([[1,0,0],[0,np.cos(p),-np.sin(p)],[0,np.sin(p),np.cos(p)]])
    t=np.radians(yaw); Ry=np.array([[np.cos(t),0,np.sin(t)],[0,1,0],[-np.sin(t),0,np.cos(t)]])
    d=d@Rx.T@Ry.T
    lon=np.arctan2(d[...,0],d[...,2]); lat=np.arcsin(np.clip(d[...,1],-1,1))
    u=(lon/(2*np.pi)+0.5)*pw; v=(0.5-lat/np.pi)*ph
    u0=np.floor(u).astype(int); v0=np.floor(v).astype(int); fu=(u-u0)[...,None]; fv=(v-v0)[...,None]
    g=lambda a,b: P[np.clip(b,0,ph-1), a%pw]
    out=g(u0,v0)*(1-fu)*(1-fv)+g(u0+1,v0)*fu*(1-fv)+g(u0,v0+1)*(1-fu)*fv+g(u0+1,v0+1)*fu*fv
    return Image.fromarray(np.clip(out,0,255).astype(np.uint8))
if __name__=="__main__":
    R="/workspace/surreal-shyam/site/public/tour360/rooms/"
    tiles=[]
    for name in ["living-styled","living2"]:
        pano=Image.open(R+name+"-2048x1024.webp").convert("RGB")
        for yaw in range(0,360,30):
            im=persp(pano,yaw,-5,75,320,200); tiles.append((name,yaw,im))
    M=Image.new("RGB",(320*6,200*4))
    from PIL import ImageDraw
    for i,(n,y,im) in enumerate(tiles):
        d=ImageDraw.Draw(im); d.text((5,5),f"{n} {y}",fill=(255,0,0)); M.paste(im,((i%6)*320,(i//6)*200))
    M.save("yaws.jpg")
