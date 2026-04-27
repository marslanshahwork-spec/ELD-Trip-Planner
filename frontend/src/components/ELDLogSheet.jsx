import { useRef, useEffect, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiDownload } from 'react-icons/fi';
import { drawELDLog } from '../utils/eldDrawer';
import './ELDLogSheet.css';

export default function ELDLogSheet({ dailyLogs }) {
  const canvasRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (canvasRef.current && dailyLogs && dailyLogs.length > 0) {
      drawELDLog(canvasRef.current, dailyLogs[currentPage]);
    }
  }, [dailyLogs, currentPage]);

  if (!dailyLogs || dailyLogs.length === 0) return null;

  const totalPages = dailyLogs.length;
  const currentLog = dailyLogs[currentPage];

  const handlePrev = () => setCurrentPage(p => Math.max(0, p - 1));
  const handleNext = () => setCurrentPage(p => Math.min(totalPages - 1, p + 1));

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `eld_log_day_${currentLog.day_number}_${currentLog.date}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="eld-log-container glass-card animate-fade-in-up" id="eld-log-sheets">
      <div className="eld-header">
        <h3 className="section-title">
          <span className="icon" style={{ background: 'var(--accent-emerald-glow)', color: 'var(--accent-emerald)' }}>📋</span>
          Daily Log Sheets
        </h3>
        <div className="eld-controls">
          <button
            className="btn btn-secondary btn-sm"
            onClick={handlePrev}
            disabled={currentPage === 0}
            id="prev-log"
          >
            <FiChevronLeft /> Prev
          </button>
          <span className="page-indicator">
            Day {currentLog.day_number} of {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleNext}
            disabled={currentPage === totalPages - 1}
            id="next-log"
          >
            Next <FiChevronRight />
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleDownload}
            title="Download as PNG"
            id="download-log"
          >
            <FiDownload />
          </button>
        </div>
      </div>

      <div className="eld-canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="eld-canvas"
          id="eld-canvas"
        />
      </div>

      {/* Hour totals summary below canvas */}
      <div className="eld-totals-bar">
        <div className="total-item">
          <span className="total-dot" style={{ background: '#64748b' }}></span>
          <span className="total-label">Off Duty</span>
          <span className="total-value">{(currentLog.total_hours?.off_duty || 0).toFixed(1)}h</span>
        </div>
        <div className="total-item">
          <span className="total-dot" style={{ background: '#8b5cf6' }}></span>
          <span className="total-label">Sleeper</span>
          <span className="total-value">{(currentLog.total_hours?.sleeper || 0).toFixed(1)}h</span>
        </div>
        <div className="total-item">
          <span className="total-dot" style={{ background: '#10b981' }}></span>
          <span className="total-label">Driving</span>
          <span className="total-value">{(currentLog.total_hours?.driving || 0).toFixed(1)}h</span>
        </div>
        <div className="total-item">
          <span className="total-dot" style={{ background: '#f59e0b' }}></span>
          <span className="total-label">On Duty</span>
          <span className="total-value">{(currentLog.total_hours?.on_duty || 0).toFixed(1)}h</span>
        </div>
        <div className="total-item total-sum">
          <span className="total-label">Total</span>
          <span className="total-value">
            {(
              (currentLog.total_hours?.off_duty || 0) +
              (currentLog.total_hours?.sleeper || 0) +
              (currentLog.total_hours?.driving || 0) +
              (currentLog.total_hours?.on_duty || 0)
            ).toFixed(1)}h
          </span>
        </div>
      </div>

      {/* Page dots */}
      {totalPages > 1 && (
        <div className="page-dots">
          {dailyLogs.map((_, idx) => (
            <button
              key={idx}
              className={`page-dot ${idx === currentPage ? 'active' : ''}`}
              onClick={() => setCurrentPage(idx)}
              aria-label={`Go to day ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
