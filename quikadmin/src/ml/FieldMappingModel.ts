import * as tf from '@tensorflow/tfjs-node';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface TrainingData {
  formField: string;
  documentField: string;
  similarity: number;
  matched: boolean;
  features: number[];
}

export interface ModelPrediction {
  confidence: number;
  shouldMatch: boolean;
  features: {
    textSimilarity: number;
    semanticSimilarity: number;
    typeSimilarity: number;
    contextSimilarity: number;
  };
}

export class FieldMappingModel {
  private model: tf.LayersModel | null = null;
  private tokenizer: Map<string, number> = new Map();
  private readonly modelPath = 'models/field-mapping';
  private readonly vocabSize = 10000;
  private readonly embeddingDim = 128;

  async initialize(): Promise<void> {
    try {
      // Try to load existing model
      await this.loadModel();
    } catch (error) {
      logger.info('No existing model found, creating new one');
      this.createModel();
    }
  }

  private createModel(): void {
    // Create a neural network for field matching
    const input = tf.input({ shape: [8] }); // 8 feature dimensions
    
    // Hidden layers with dropout for regularization
    const dense1 = tf.layers.dense({ 
      units: 64, 
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
    }).apply(input);
    
    const dropout1 = tf.layers.dropout({ rate: 0.2 }).apply(dense1);
    
    const dense2 = tf.layers.dense({ 
      units: 32, 
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
    }).apply(dropout1);
    
    const dropout2 = tf.layers.dropout({ rate: 0.2 }).apply(dense2);
    
    const dense3 = tf.layers.dense({ 
      units: 16, 
      activation: 'relu' 
    }).apply(dropout2);
    
    // Output layer for binary classification
    const output = tf.layers.dense({ 
      units: 1, 
      activation: 'sigmoid' 
    }).apply(dense3);

    this.model = tf.model({ 
      inputs: input, 
      outputs: output as tf.SymbolicTensor 
    });

    // Compile with optimizer
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision', 'recall']
    });

    logger.info('Field mapping model created');
  }

  async train(trainingData: TrainingData[]): Promise<void> {
    if (!this.model) {
      this.createModel();
    }

    // Prepare training data
    const features: number[][] = [];
    const labels: number[] = [];

    for (const data of trainingData) {
      features.push(this.extractFeatures(data));
      labels.push(data.matched ? 1 : 0);
    }

    // Convert to tensors
    const xTrain = tf.tensor2d(features);
    const yTrain = tf.tensor2d(labels, [labels.length, 1]);

    // Split into training and validation
    const splitIdx = Math.floor(features.length * 0.8);
    const xVal = xTrain.slice([splitIdx, 0], [-1, -1]);
    const yVal = yTrain.slice([splitIdx, 0], [-1, -1]);
    const xTrainSet = xTrain.slice([0, 0], [splitIdx, -1]);
    const yTrainSet = yTrain.slice([0, 0], [splitIdx, -1]);

    // Train the model
    const history = await this.model!.fit(xTrainSet, yTrainSet, {
      epochs: 100,
      batchSize: 32,
      validationData: [xVal, yVal],
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            logger.info(`Training epoch ${epoch}: loss=${logs?.loss?.toFixed(4)}, accuracy=${logs?.acc?.toFixed(4)}`);
          }
        }
      }
    });

    // Save the trained model
    await this.saveModel();

    // Cleanup tensors
    xTrain.dispose();
    yTrain.dispose();
    xVal.dispose();
    yVal.dispose();
    xTrainSet.dispose();
    yTrainSet.dispose();

    logger.info('Model training completed');
  }

  private extractFeatures(data: TrainingData): number[] {
    // Extract 8 features for field matching
    return [
      this.calculateTextSimilarity(data.formField, data.documentField),
      this.calculateSemanticSimilarity(data.formField, data.documentField),
      this.calculateTypeSimilarity(data.formField, data.documentField),
      this.calculateLengthSimilarity(data.formField, data.documentField),
      this.calculatePositionalSimilarity(data.formField, data.documentField),
      this.hasCommonTokens(data.formField, data.documentField) ? 1 : 0,
      this.isExactMatch(data.formField, data.documentField) ? 1 : 0,
      data.similarity // Pre-calculated similarity score
    ];
  }

  async predict(formField: string, documentField: string, similarity: number): Promise<ModelPrediction> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    const features = this.extractFeatures({
      formField,
      documentField,
      similarity,
      matched: false,
      features: []
    });

    const input = tf.tensor2d([features]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const confidence = (await prediction.data())[0];

    input.dispose();
    prediction.dispose();

    return {
      confidence,
      shouldMatch: confidence > 0.5,
      features: {
        textSimilarity: features[0],
        semanticSimilarity: features[1],
        typeSimilarity: features[2],
        contextSimilarity: features[4]
      }
    };
  }

  private calculateTextSimilarity(str1: string, str2: string): number {
    // Levenshtein distance normalized
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;
    
    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    return 1 - (distance / maxLen);
  }

  private calculateSemanticSimilarity(str1: string, str2: string): number {
    // Simple semantic similarity based on common words
    const words1 = new Set(str1.toLowerCase().split(/\W+/));
    const words2 = new Set(str2.toLowerCase().split(/\W+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateTypeSimilarity(str1: string, str2: string): number {
    // Check if both fields are of similar type
    const types = ['email', 'phone', 'date', 'name', 'address', 'number', 'currency'];
    
    let type1 = 'unknown';
    let type2 = 'unknown';
    
    for (const type of types) {
      if (str1.toLowerCase().includes(type)) type1 = type;
      if (str2.toLowerCase().includes(type)) type2 = type;
    }
    
    return type1 === type2 ? 1 : 0;
  }

  private calculateLengthSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1;
    
    return 1 - Math.abs(len1 - len2) / maxLen;
  }

  private calculatePositionalSimilarity(str1: string, str2: string): number {
    // Check if fields have similar positional indicators
    const hasNumber1 = /\d/.test(str1);
    const hasNumber2 = /\d/.test(str2);
    
    if (hasNumber1 && hasNumber2) {
      const num1 = parseInt(str1.match(/\d+/)?.[0] || '0');
      const num2 = parseInt(str2.match(/\d+/)?.[0] || '0');
      
      if (num1 === num2) return 1;
      return Math.max(0, 1 - Math.abs(num1 - num2) / 10);
    }
    
    return hasNumber1 === hasNumber2 ? 0.5 : 0;
  }

  private hasCommonTokens(str1: string, str2: string): boolean {
    const tokens1 = str1.toLowerCase().split(/\W+/);
    const tokens2 = str2.toLowerCase().split(/\W+/);
    
    return tokens1.some(t => tokens2.includes(t));
  }

  private isExactMatch(str1: string, str2: string): boolean {
    return str1.toLowerCase().replace(/\W+/g, '') === str2.toLowerCase().replace(/\W+/g, '');
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  async saveModel(): Promise<void> {
    if (!this.model) {
      throw new Error('No model to save');
    }

    await this.model.save(`file://${this.modelPath}`);
    logger.info(`Model saved to ${this.modelPath}`);
  }

  async loadModel(): Promise<void> {
    this.model = await tf.loadLayersModel(`file://${this.modelPath}/model.json`);
    logger.info('Model loaded successfully');
  }

  async evaluateModel(testData: TrainingData[]): Promise<{
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  }> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    for (const data of testData) {
      const prediction = await this.predict(data.formField, data.documentField, data.similarity);
      const predicted = prediction.shouldMatch;
      const actual = data.matched;

      if (predicted && actual) truePositives++;
      else if (predicted && !actual) falsePositives++;
      else if (!predicted && actual) falseNegatives++;
      else if (!predicted && !actual) trueNegatives++;
    }

    const accuracy = (truePositives + trueNegatives) / testData.length;
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

    return { accuracy, precision, recall, f1Score };
  }
}