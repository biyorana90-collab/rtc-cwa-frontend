import React, { useRef, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Eraser, Paintbrush, RotateCcw, Lock, Square, Circle, Type, Download } from 'lucide-react';

interface WhiteboardProps {
  socket: Socket | null;
  roomId: string;
  isHost: boolean;
  canEdit?: boolean;
}

type Tool = 'pen' | 'eraser' | 'rectangle' | 'circle' | 'text';

export const Whiteboard: React.FC<WhiteboardProps> = ({ socket, roomId, isHost, canEdit = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(3);
  const [activeTool, setActiveTool] = useState<Tool>('pen');
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);

  const isEditable = isHost || canEdit;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) tempCtx.drawImage(canvas, 0, 0);

        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;

        ctx.drawImage(tempCanvas, 0, 0);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    if (!socket) return;

    socket.on('draw-line', (data: { x0: number; y0: number; x1: number; y1: number; color: string; lineWidth: number; tool?: Tool }) => {
      const currentCanvas = canvasRef.current;
      if (!currentCanvas) return;
      const w = currentCanvas.width;
      const h = currentCanvas.height;
      drawShape(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, data.lineWidth, data.tool || 'pen', false);
    });

    socket.on('clear-whiteboard', () => {
      const currentCanvas = canvasRef.current;
      if (!currentCanvas) return;
      const currentCtx = currentCanvas.getContext('2d');
      if (currentCtx) {
        currentCtx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
      }
    });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      socket.off('draw-line');
      socket.off('clear-whiteboard');
    };
  }, [socket]);

  const drawShape = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    drawColor: string,
    width: number,
    tool: Tool,
    emit: boolean
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = tool === 'eraser' ? '#0f172a' : drawColor;
    ctx.fillStyle = drawColor;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';

    if (tool === 'pen' || tool === 'eraser') {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    } else if (tool === 'rectangle') {
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    } else if (tool === 'circle') {
      const radius = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
      ctx.arc(x0, y0, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.closePath();

    if (emit && socket && roomId) {
      const w = canvas.width;
      const h = canvas.height;
      socket.emit('draw-line', {
        roomId,
        x0: x0 / w,
        y0: y0 / h,
        x1: x1 / w,
        y1: y1 / h,
        color: drawColor,
        lineWidth: width,
        tool,
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditable) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    setIsDrawing(true);
    lastPos.current = { x, y };
    startPos.current = { x, y };

    if (activeTool === 'text') {
      const text = prompt('Enter text to render on whiteboard:');
      if (text && ctx) {
        ctx.font = `${widthToFont(lineWidth)}px sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
      }
      setIsDrawing(false);
    }
  };

  const widthToFont = (w: number) => Math.max(14, w * 5);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditable || !isDrawing || !lastPos.current || !startPos.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const currentPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const ctx = canvas.getContext('2d');

    if (activeTool === 'rectangle' || activeTool === 'circle') {
      if (ctx && snapshotRef.current) {
        ctx.putImageData(snapshotRef.current, 0, 0);
      }
      drawShape(startPos.current.x, startPos.current.y, currentPos.x, currentPos.y, color, lineWidth, activeTool, false);
    } else {
      drawShape(lastPos.current.x, lastPos.current.y, currentPos.x, currentPos.y, color, lineWidth, activeTool, true);
      lastPos.current = currentPos;
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if ((activeTool === 'rectangle' || activeTool === 'circle') && startPos.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;
        drawShape(startPos.current.x, startPos.current.y, endX, endY, color, lineWidth, activeTool, true);
      }
    }
    setIsDrawing(false);
    lastPos.current = null;
    startPos.current = null;
  };

  const clearCanvas = () => {
    if (!isEditable) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (socket && roomId) {
      socket.emit('clear-whiteboard', { roomId });
    }
  };

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = `whiteboard-${roomId}-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
      {/* Controls Bar */}
      <div className="p-3 bg-slate-800 border-b border-slate-700 flex flex-wrap items-center gap-3">
        {isEditable ? (
          <>
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => setActiveTool('pen')}
                className={`p-1.5 rounded transition ${activeTool === 'pen' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Pen"
              >
                <Paintbrush className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTool('eraser')}
                className={`p-1.5 rounded transition ${activeTool === 'eraser' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Eraser"
              >
                <Eraser className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTool('rectangle')}
                className={`p-1.5 rounded transition ${activeTool === 'rectangle' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Rectangle"
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTool('circle')}
                className={`p-1.5 rounded transition ${activeTool === 'circle' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Circle"
              >
                <Circle className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTool('text')}
                className={`p-1.5 rounded transition ${activeTool === 'text' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Add Text"
              >
                <Type className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                title="Color Picker"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span>Width:</span>
              <input
                type="range"
                min="1"
                max="15"
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="w-20 accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={exportCanvas}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition"
                title="Export Whiteboard Image"
              >
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              <button
                onClick={clearCanvas}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Clear All
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
            <Lock className="w-4 h-4" /> View Only Mode (Controlled by Host)
          </div>
        )}
      </div>

      {/* Canvas Area */}
      <div className={`flex-1 w-full h-full relative ${isEditable ? 'cursor-crosshair' : 'cursor-not-allowed'}`}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="absolute top-0 left-0 w-full h-full"
        />
      </div>
    </div>
  );
};