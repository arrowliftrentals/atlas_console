'use client';

import dynamic from 'next/dynamic';

// Dynamically import to avoid SSR issues with Three.js
const NeuralNetworkScene = dynamic(
  () => import('../../components/NeuralNetworkScene'),
  { ssr: false }
);

export default function NeuralNetworkPage() {
  return <NeuralNetworkScene />;
}
