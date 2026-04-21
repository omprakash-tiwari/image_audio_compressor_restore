// Global state
let state = {
    originalAudioData: null,
    compressedAudioData: null,
    restoredAudioData: null,
    originalAudioContext: null,
    currentSpectrum: null,
    compressionMetadata: null,
    charts: {}
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializeAudioContext();
});

function setupEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const audioFile = document.getElementById('audioFile');
    const compressionSlider = document.getElementById('compressionSlider');

    // Upload area drag and drop
    uploadArea.addEventListener('click', () => audioFile.click());
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.opacity = '0.6';
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.opacity = '1';
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.opacity = '1';
        if (e.dataTransfer.files.length) {
            audioFile.files = e.dataTransfer.files;
            handleFileUpload();
        }
    });

    audioFile.addEventListener('change', handleFileUpload);

    // Compression slider
    compressionSlider.addEventListener('input', (e) => {
        document.getElementById('compressionValue').textContent = e.target.value;
    });

    // Buttons
    document.getElementById('compressBtn').addEventListener('click', handleCompression);
    document.getElementById('restoreBtn').addEventListener('click', handleRestoration);
    document.getElementById('downloadOriginalBtn').addEventListener('click', () => 
        downloadAudio(state.originalAudioData, 'original-audio')
    );
    document.getElementById('downloadCompressedBtn').addEventListener('click', () => 
        downloadAudio(state.compressedAudioData, 'compressed-audio')
    );
    document.getElementById('downloadRestoredBtn').addEventListener('click', () => 
        downloadAudio(state.restoredAudioData, 'restored-audio')
    );
    document.getElementById('playOriginalBtn').addEventListener('click', () => 
        playAudio(state.originalAudioData, 'original')
    );
    document.getElementById('playRestoredBtn').addEventListener('click', () => 
        playAudio(state.restoredAudioData, 'restored')
    );
}

function initializeAudioContext() {
    const audioContext = window.AudioContext || window.webkitAudioContext;
    state.originalAudioContext = new audioContext();
}

async function handleFileUpload() {
    const fileInput = document.getElementById('audioFile');
    const file = fileInput.files[0];

    if (!file) return;

    const formData = new FormData();
    formData.append('audio', file);

    try {
        showLoading('Analyzing audio...');
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            state.originalAudioData = new Float32Array(data.audioData);
            displayFileInfo(data);
            displayOriginalSpectrum(data);
            
            document.getElementById('compressBtn').style.display = 'inline-block';
            document.getElementById('playOriginalBtn').style.display = 'inline-block';
            document.getElementById('downloadOriginalBtn').style.display = 'inline-block';
            
            showSuccess('Audio uploaded and analyzed successfully!');
        } else {
            showError('Failed to upload audio: ' + data.error);
        }
    } catch (error) {
        showError('Error uploading file: ' + error.message);
    }
}

function displayFileInfo(data) {
    document.getElementById('fileInfo').style.display = 'block';
    document.getElementById('fileName').textContent = data.fileName;
    document.getElementById('fileDuration').textContent = data.duration.toFixed(2);
    document.getElementById('fileSampleRate').textContent = data.sampleRate.toLocaleString();
    document.getElementById('fileSamples').textContent = data.samples.toLocaleString();
}

function displayOriginalSpectrum(data) {
    const ctx = document.getElementById('originalSpectrumChart').getContext('2d');
    
    if (state.charts.originalSpectrum) {
        state.charts.originalSpectrum.destroy();
    }

    const labels = Array.from({ length: data.spectrum.length }, (_, i) => i);

    state.charts.originalSpectrum = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Original Audio Spectrum',
                data: data.spectrum,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Frequency Bins'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Magnitude'
                    }
                }
            }
        }
    });
}

async function handleCompression() {
    if (!state.originalAudioData) {
        showError('Please upload an audio file first');
        return;
    }

    const compressionRatio = document.getElementById('compressionSlider').value / 100;
    const fileInput = document.getElementById('audioFile');
    const file = fileInput.files[0];

    const formData = new FormData();
    formData.append('audio', file);
    formData.append('compressionRatio', compressionRatio);

    try {
        showLoading('Compressing audio...');
        const response = await fetch('/api/compress', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            state.compressionMetadata = data.compression;
            state.compressedAudioData = new Float32Array(data.compressedAudioData);
            displayCompressionResults(data);
            displayCompressionComparison(data);
            
            document.getElementById('restoreBtn').style.display = 'inline-block';
            document.getElementById('downloadCompressedBtn').style.display = 'inline-block';
            
            showSuccess('Audio compressed successfully!');
        } else {
            showError('Compression failed: ' + data.error);
        }
    } catch (error) {
        showError('Error compressing audio: ' + error.message);
    }
}

function displayCompressionResults(data) {
    document.getElementById('compressionResults').style.display = 'block';
    document.getElementById('originalSize').textContent = (data.compression.originalSize / 1024).toFixed(2) + ' KB';
    document.getElementById('compressedSize').textContent = (data.compression.compressedSize / 1024).toFixed(2) + ' KB';
    document.getElementById('compressionRatio').textContent = data.compression.compressionPercentage + '%';
    document.getElementById('dataRemoved').textContent = data.compression.samplesRemoved.toLocaleString();
}

function displayCompressionComparison(data) {
    const ctx = document.getElementById('compressionComparisonChart').getContext('2d');
    
    if (state.charts.compressionComparison) {
        state.charts.compressionComparison.destroy();
    }

    const labels = Array.from({ length: Math.min(data.spectrum.original.length, 256) }, (_, i) => i);

    state.charts.compressionComparison = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Original Spectrum',
                    data: data.spectrum.original.slice(0, 256),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.05)',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0
                },
                {
                    label: 'Compressed Spectrum',
                    data: data.spectrum.compressed.slice(0, 256),
                    borderColor: '#11998e',
                    backgroundColor: 'rgba(17, 153, 142, 0.05)',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    stacked: false
                }
            }
        }
    });

    // Update compressed spectrum chart on receiver side
    displayCompressedSpectrumChart(data.spectrum.compressed);
}

function displayCompressedSpectrumChart(spectrum) {
    const ctx = document.getElementById('compressedSpectrumChart').getContext('2d');
    
    if (state.charts.compressedSpectrum) {
        state.charts.compressedSpectrum.destroy();
    }

    const labels = Array.from({ length: spectrum.length }, (_, i) => i);

    state.charts.compressedSpectrum = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Compressed Audio Spectrum',
                data: spectrum,
                borderColor: '#11998e',
                backgroundColor: 'rgba(17, 153, 142, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Frequency Bins'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Magnitude'
                    }
                }
            }
        }
    });
}

async function handleRestoration() {
    if (!state.compressedAudioData || !state.compressionMetadata) {
        showError('Please compress audio first');
        return;
    }

    try {
        showLoading('Restoring audio...');
        const response = await fetch('/api/restore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                compressedData: Array.from(state.compressedAudioData),
                metadata: state.compressionMetadata,
                originalData: Array.from(state.originalAudioData)
            })
        });

        const data = await response.json();

        if (data.success) {
            state.restoredAudioData = new Float32Array(data.restoredData);
            displayRestoredAudio(data);
            displayComparison();
            
            document.getElementById('restorationResults').style.display = 'block';
            document.getElementById('comparisonSection').style.display = 'block';
            document.getElementById('playRestoredBtn').style.display = 'inline-block';
            document.getElementById('downloadRestoredBtn').style.display = 'inline-block';
            
            showSuccess('Audio restored successfully!');
        } else {
            showError('Restoration failed: ' + data.error);
        }
    } catch (error) {
        showError('Error restoring audio: ' + error.message);
    }
}

function displayRestoredAudio(data) {
    const ctx = document.getElementById('restoredSpectrumChart').getContext('2d');
    
    if (state.charts.restoredSpectrum) {
        state.charts.restoredSpectrum.destroy();
    }

    const labels = Array.from({ length: data.spectrum.length }, (_, i) => i);

    state.charts.restoredSpectrum = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Restored Audio Spectrum',
                data: data.spectrum,
                borderColor: '#ff9800',
                backgroundColor: 'rgba(255, 152, 0, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Frequency Bins'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Magnitude'
                    }
                }
            }
        }
    });
}

async function displayComparison() {
    try {
        const response = await fetch('/api/compare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                originalData: Array.from(state.originalAudioData),
                compressedData: Array.from(state.compressedAudioData),
                restoredData: Array.from(state.restoredAudioData)
            })
        });

        const data = await response.json();
        if (data.success) {
            displayComparisonMetrics(data);
            displayComparisonCharts(data);
        }
    } catch (error) {
        console.error('Comparison error:', error);
        showError('Error comparing audio: ' + error.message);
    }
}

function displayComparisonMetrics(data) {
    document.getElementById('compressionAccuracy').textContent = 
        parseFloat(data.compressionAccuracy.accuracy).toFixed(1) + '%';
    document.getElementById('compressionRMSE').textContent = 
        parseFloat(data.compressionAccuracy.rmse).toFixed(4);
    
    document.getElementById('restorationAccuracy').textContent = 
        parseFloat(data.restorationAccuracy.accuracy).toFixed(1) + '%';
    document.getElementById('restorationRMSE').textContent = 
        parseFloat(data.restorationAccuracy.rmse).toFixed(4);
}

function displayComparisonCharts(data) {
    // Spectrum comparison
    const ctx1 = document.getElementById('comparisonChart').getContext('2d');
    
    if (state.charts.comparison) {
        state.charts.comparison.destroy();
    }

    const labels = Array.from({ length: Math.min(data.spectra.original.length, 256) }, (_, i) => i);

    state.charts.comparison = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Original',
                    data: data.spectra.original.slice(0, 256),
                    borderColor: '#667eea',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0
                },
                {
                    label: 'Compressed',
                    data: data.spectra.compressed.slice(0, 256),
                    borderColor: '#11998e',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0
                },
                {
                    label: 'Restored',
                    data: data.spectra.restored.slice(0, 256),
                    borderColor: '#ff9800',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });

    // Energy analysis
    const ctx2 = document.getElementById('energyChart').getContext('2d');
    
    if (state.charts.energy) {
        state.charts.energy.destroy();
    }

    state.charts.energy = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['Original', 'Compressed', 'Restored'],
            datasets: [{
                label: 'Average Energy',
                data: [
                    data.energyAnalysis.original,
                    data.energyAnalysis.compressed,
                    data.energyAnalysis.restored
                ],
                backgroundColor: [
                    'rgba(102, 126, 234, 0.7)',
                    'rgba(17, 153, 142, 0.7)',
                    'rgba(255, 152, 0, 0.7)'
                ],
                borderColor: [
                    '#667eea',
                    '#11998e',
                    '#ff9800'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Energy Level'
                    }
                }
            }
        }
    });
}

async function downloadAudio(audioData, filename) {
    if (!audioData) {
        showError('No audio data to download');
        return;
    }

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                audioData: Array.from(audioData),
                fileName: filename
            })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename + '.wav';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showSuccess('Audio downloaded successfully!');
        } else {
            showError('Failed to download audio');
        }
    } catch (error) {
        showError('Error downloading audio: ' + error.message);
    }
}

function playAudio(audioData, type) {
    if (!audioData) {
        showError('No audio data to play');
        return;
    }

    try {
        const audioContext = state.originalAudioContext;
        
        // Resume audio context if suspended (required by most browsers)
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                playAudioBuffer(audioData, audioContext, type);
            });
        } else {
            playAudioBuffer(audioData, audioContext, type);
        }
    } catch (error) {
        showError('Error playing audio: ' + error.message);
    }
}

function playAudioBuffer(audioData, audioContext, type) {
    try {
        const numSamples = audioData.length || audioData.byteLength / 4;
        const buffer = audioContext.createBuffer(1, numSamples, 44100);
        const channelData = buffer.getChannelData(0);
        
        if (audioData instanceof Float32Array) {
            channelData.set(audioData);
        } else {
            for (let i = 0; i < Math.min(audioData.length, numSamples); i++) {
                channelData[i] = audioData[i] || 0;
            }
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);

        showSuccess('Playing ' + type + ' audio...');
    } catch (error) {
        showError('Error creating audio buffer: ' + error.message);
    }
}

function showLoading(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'loading';
    errorDiv.innerHTML = message + ' <div class="loading" style="display: inline-block; margin-left: 10px;"></div>';
    console.log(message);
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    
    const container = document.querySelector('.sender-panel');
    container.insertBefore(errorDiv, container.firstChild);
    
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    
    const container = document.querySelector('.receiver-panel');
    container.insertBefore(successDiv, container.firstChild);
    
    setTimeout(() => successDiv.remove(), 5000);
}
