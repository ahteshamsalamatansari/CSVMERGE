import React, { useState, useCallback, useRef } from 'react';
import { Upload, Download, Merge, FileText, BarChart3, AlertCircle, CheckCircle, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Papa from 'papaparse';

const CSVMerger = () => {
  const [files, setFiles] = useState([]);
  const [mergedData, setMergedData] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState(null);
  const [visualization, setVisualization] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef();

  // Efficient file processing with streaming
  const processFileChunk = (file, chunkSize = 1024 * 1024) => { // 1MB chunks
    return new Promise((resolve, reject) => {
      const results = [];
      let isFirstChunk = true;
      let headers = [];

      Papa.parse(file, {
        chunkSize,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        chunk: (chunk, parser) => {
          if (isFirstChunk) {
            headers = chunk.meta.fields;
            isFirstChunk = false;
          }
          results.push(...chunk.data);
          setProgress(prev => Math.min(prev + (chunk.data.length / 10000), 90));
        },
        complete: () => {
          resolve({ data: results, headers });
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  };

  const handleFileUpload = useCallback((event) => {
    const uploadedFiles = Array.from(event.target.files);
    const csvFiles = uploadedFiles.filter(file => file.name.toLowerCase().endsWith('.csv'));
    
    if (csvFiles.length === 0) {
      setError('Please upload CSV files only');
      return;
    }

    setFiles(csvFiles);
    setError(null);
    setMergedData(null);
    setStats(null);
    setVisualization(null);
  }, []);

  const mergeCSVFiles = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setProgress(0);
    setError(null);

    try {
      let allData = [];
      let commonHeaders = null;
      const fileStats = [];

      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Processing file ${i + 1}/${files.length}: ${file.name}`);
        
        const result = await processFileChunk(file);
        
        // Establish common headers from first file
        if (commonHeaders === null) {
          commonHeaders = result.headers;
        }

        // Filter data to match common headers
        const filteredData = result.data.map(row => {
          const filteredRow = {};
          commonHeaders.forEach(header => {
            filteredRow[header] = row[header] || '';
          });
          return filteredRow;
        });

        allData = allData.concat(filteredData);
        
        fileStats.push({
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(2),
          rows: result.data.length
        });

        setProgress((i + 1) / files.length * 90);
      }

      // Generate statistics
      const stats = {
        totalFiles: files.length,
        totalRows: allData.length,
        totalColumns: commonHeaders.length,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
        fileBreakdown: fileStats
      };

      // Generate visualization data
      const vizData = generateVisualizationData(allData, commonHeaders);

      setMergedData(allData);
      setStats(stats);
      setVisualization(vizData);
      setProgress(100);

    } catch (err) {
      setError(`Error merging files: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const generateVisualizationData = (data, headers) => {
    // Sample data for visualization (first 1000 rows for performance)
    const sampleData = data.slice(0, 1000);
    
    // Generate column statistics
    const columnStats = headers.map(header => {
      const values = sampleData.map(row => row[header]).filter(val => val !== '' && val != null);
      const numericValues = values.filter(val => !isNaN(parseFloat(val))).map(val => parseFloat(val));
      
      return {
        column: header,
        totalValues: values.length,
        numericCount: numericValues.length,
        avgValue: numericValues.length > 0 ? (numericValues.reduce((a, b) => a + b, 0) / numericValues.length).toFixed(2) : 0,
        nullCount: sampleData.length - values.length
      };
    });

    // Row count progression
    const fileProgression = [];
    let cumulativeRows = 0;
    data.forEach((_, index) => {
      if (index % Math.ceil(data.length / 20) === 0) { // 20 data points
        cumulativeRows = index;
        fileProgression.push({
          index: index,
          rows: cumulativeRows
        });
      }
    });

    return {
      columnStats: columnStats.slice(0, 10), // Limit for performance
      fileProgression
    };
  };

  const downloadMergedCSV = () => {
    if (!mergedData) return;

    const csv = Papa.unparse(mergedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `merged_data_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            High-Performance CSV Merger
          </h1>
          <p className="text-gray-600">Merge large CSV files efficiently with real-time visualization</p>
        </div>

        {/* File Upload Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <Upload className="mr-2 text-blue-500" size={24} />
              Upload CSV Files
            </h2>
            <span className="text-sm text-gray-500">Supports files up to 200MB+</span>
          </div>
          
          <div 
            className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer bg-blue-50 hover:bg-blue-100"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto mb-4 text-blue-500" size={48} />
            <p className="text-lg font-medium text-gray-700 mb-2">Drop CSV files here or click to upload</p>
            <p className="text-sm text-gray-500">Multiple files supported • Fast processing • Automatic merging</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {files.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium text-gray-700 mb-2">Selected Files ({files.length})</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center">
                      <FileText className="text-green-500 mr-2" size={16} />
                      <span className="text-sm font-medium">{file.name}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4 mb-6">
          <button
            onClick={mergeCSVFiles}
            disabled={files.length === 0 || processing}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center shadow-lg"
          >
            <Merge className="mr-2" size={20} />
            {processing ? 'Merging...' : 'Merge Files'}
          </button>

          {mergedData && (
            <button
              onClick={downloadMergedCSV}
              className="bg-gradient-to-r from-green-500 to-teal-600 text-white px-8 py-3 rounded-xl font-medium hover:from-green-600 hover:to-teal-700 transition-all flex items-center shadow-lg"
            >
              <Download className="mr-2" size={20} />
              Download Merged CSV
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {processing && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Processing...</span>
              <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center">
            <AlertCircle className="text-red-500 mr-2" size={20} />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Success Display */}
        {mergedData && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center">
            <CheckCircle className="text-green-500 mr-2" size={20} />
            <span className="text-green-700">Files merged successfully!</span>
          </div>
        )}

        {/* Statistics */}
        {stats && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <BarChart3 className="mr-2 text-green-500" size={24} />
              Merge Statistics
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalFiles}</div>
                <div className="text-sm text-gray-600">Files Merged</div>
              </div>
              <div className="bg-green-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-green-600">{stats.totalRows.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Total Rows</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.totalColumns}</div>
                <div className="text-sm text-gray-600">Columns</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-orange-600">{(stats.totalSize / (1024 * 1024)).toFixed(1)} MB</div>
                <div className="text-sm text-gray-600">Total Size</div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-medium text-gray-700 mb-3">File Breakdown</h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {stats.fileBreakdown.map((file, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 truncate mr-4">{file.name}</span>
                    <div className="flex space-x-4 text-gray-500">
                      <span>{file.rows.toLocaleString()} rows</span>
                      <span>{file.size} MB</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Visualizations */}
        {visualization && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Column Statistics */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Column Analysis</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={visualization.columnStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="column" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#f8fafc', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar dataKey="totalValues" fill="#3b82f6" />
                  <Bar dataKey="nullCount" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Data Growth */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Data Growth Pattern</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={visualization.fileProgression}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="index" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#f8fafc', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="rows" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVMerger;