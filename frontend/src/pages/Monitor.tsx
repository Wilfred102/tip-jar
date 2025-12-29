import React, { useCallback, useEffect, useState } from 'react';
import { BACKEND_API_URL } from '../config';

interface ErrorDataPoint {
  ts: number;
  count: number;
}

export default function Monitor() {
  const [series, setSeries] = useState<ErrorDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const r = await fetch(`${BACKEND_API_URL}/api/monitor/errors`);
      
      if (!r.ok) {
        throw new Error(`Monitor API returned ${r.status}: ${r.statusText}`);
      }
      
      const data = await r.json();
      const items = Array.isArray(data.series) ? data.series : [];
      
      setSeries(
        items.map((p: any) => ({
          ts: Number(p.ts),
          count: Number(p.count)
        }))
      );
    } catch (e: any) {
      console.error('Monitor fetch error:', e);
      setError(e?.message || 'Failed to load error data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // Format timestamp for display
  const formatTimestamp = (ts: number): string => {
    return new Date(ts * 1000).toLocaleString();
  };

  // Calculate max count for chart scaling
  const maxCount = Math.max(...series.map(s => s.count), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Error Monitor</h1>
              <p className="text-gray-600 mt-1">
                Real-time error tracking and analytics - data
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={fetchData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
              
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  autoRefresh
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {autoRefresh ? '● Auto-refresh ON' : 'Auto-refresh OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-red-600 mt-0.5 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="font-semibold text-red-900">Error Loading Realtime Data</h3>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-600">Total Data Points</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">{series.length}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-600">Total Errors</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {series.reduce((sum, s) => sum + s.count, 0)}
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-600">Peak Error Count - Data flow</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">{maxCount}</p>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Error Timeline</h2>
          
          {loading && series.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : series.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <p className="text-lg font-medium">No data available</p>
                <p className="text-sm mt-1">Error data will appear here when available</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {series.map((point, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-40 text-sm text-gray-600 flex-shrink-0">
                    {formatTimestamp(point.ts)}
                  </div>
                  
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-300"
                        style={{
                          width: `${maxCount > 0 ? (point.count / maxCount) * 100 : 0}%`
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-end pr-3">
                        <span className="text-sm font-medium text-gray-700">
                          {point.count} {point.count === 1 ? 'error' : 'errors'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Raw Data Table */}
        {series.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Raw Data</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unix Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Error Count
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {series.map((point, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTimestamp(point.ts)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {point.ts}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            point.count === 0
                              ? 'bg-green-100 text-green-800'
                              : point.count < 10
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {point.count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}