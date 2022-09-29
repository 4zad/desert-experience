import "./Media.css";

export default function Media({ src }) {
  const type = src.split(".").pop();
  const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(type);
  return (
    <div className="Media">
      {isImage && <img src={src} alt="" />}
      {!isImage && <video src={src} playsInline autoPlay muted />}
    </div>
  );
}
