const COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#FF6600', '#FFCC00',
  '#00CC00', '#0066FF', '#9900FF', '#FF00CC', '#663300',
  '#FF9999', '#FFCC99', '#FFFF99', '#99FF99', '#99CCFF',
  '#CC99FF', '#FF99CC', '#C0C0C0', '#808080', '#404040',
];

const BRUSH_SIZES = [2, 4, 8, 14, 22];

export default function DrawingToolbar({
  color, setColor,
  brushSize, setBrushSize,
  tool, setTool,
  onUndo, onClear,
}) {
  return (
    <div className="drawing-toolbar">
      <div className="toolbar-section">
        <div className="tool-group">
          <button
            className={`tool-btn ${tool === 'pen' ? 'active' : ''}`}
            onClick={() => setTool('pen')}
            title="Pen"
          >✏️</button>
          <button
            className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
            onClick={() => setTool('eraser')}
            title="Eraser"
          >🧹</button>
        </div>
      </div>

      <div className="toolbar-section">
        <div className="color-palette">
          {COLORS.map(c => (
            <button
              key={c}
              className={`color-swatch ${color === c ? 'selected' : ''}`}
              style={{ background: c, border: c === '#FFFFFF' ? '1px solid #ddd' : 'none' }}
              onClick={() => { setColor(c); setTool('pen'); }}
              title={c}
            />
          ))}
        </div>
      </div>

      <div className="toolbar-section">
        <div className="size-options">
          {BRUSH_SIZES.map(size => (
            <button
              key={size}
              className={`size-btn ${brushSize === size ? 'active' : ''}`}
              onClick={() => setBrushSize(size)}
              title={`Size ${size}`}
            >
              <span
                className="size-preview"
                style={{
                  width: Math.min(size * 1.5, 24),
                  height: Math.min(size * 1.5, 24),
                  background: tool === 'eraser' ? '#aaa' : color,
                }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-section">
        <div className="action-group">
          <button className="action-btn undo-btn" onClick={onUndo} title="Undo">↩️ Undo</button>
          <button className="action-btn clear-btn" onClick={onClear} title="Clear canvas">🗑️ Clear</button>
        </div>
      </div>
    </div>
  );
}
