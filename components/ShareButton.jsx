export default function ShareButton({ videoUrl }) {
  const handleShare = () => {
    const message = `Look what I made! 😂 Tap GiggleGram.com to make yours!\n\n${videoUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <button
      onClick={handleShare}
      className="w-full bg-[#25D366] text-white text-xl font-bold py-6 px-8 rounded-2xl shadow-lg active:scale-95 transition-transform"
      style={{ minHeight: '70px', fontSize: '20px' }}
    >
      📱 Send to Family Group
    </button>
  );
}