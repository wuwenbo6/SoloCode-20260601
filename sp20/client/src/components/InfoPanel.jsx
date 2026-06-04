const InfoPanel = ({ exhibit, onClose, onView3D }) => {
  if (!exhibit) return null;

  return (
    <div className="info-panel">
      <button className="info-panel-close" onClick={onClose}>×</button>
      <img 
        src={exhibit.image} 
        alt={exhibit.name} 
        className="info-panel-image"
      />
      <h2 className="info-panel-title">{exhibit.name}</h2>
      <div className="info-panel-meta">
        <span>年代: {exhibit.year}</span>
        <span>来源: {exhibit.origin}</span>
      </div>
      <p className="info-panel-description">{exhibit.description}</p>
      
      {onView3D && (
        <button
          onClick={onView3D}
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'transform 0.2s'
          }}
        >
          🔄 3D 查看
        </button>
      )}
    </div>
  );
};

export default InfoPanel;
