'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { Camera, Incident, Selection } from '../types';

const CityMap = dynamic(() => import('./CityMap'), { ssr: false, loading: () => <div className="map-loading">Loading Dublin map…</div> });
export interface MapProps { cameras: Camera[]; incidents: Incident[]; selection: Selection; onSelect: (selection: Selection) => void }
export function MapPanel(props: MapProps) {
  const [layers, setLayers] = useState({ cameras: true, incidents: true });
  const [fit, setFit] = useState(0);
  return <section className="map-panel" aria-label="Dublin incident map">
    <div className="section-heading"><div><span className="eyebrow">CITY OVERVIEW</span><h2>Dublin, Ireland</h2></div><button className="text-button" onClick={() => setFit((value) => value + 1)}>Fit Dublin coverage</button></div>
    <fieldset className="map-layers"><legend className="sr-only">Map layers</legend>
      {(['cameras', 'incidents'] as const).map((layer) => <label key={layer}><input type="checkbox" checked={layers[layer]} onChange={(event) => setLayers({ ...layers, [layer]: event.target.checked })} /><i className={'legend-' + layer} />{layer[0].toUpperCase() + layer.slice(1)}</label>)}
    </fieldset>
    <CityMap {...props} layers={layers} fit={fit} />
    <div className="map-footer"><span><b>{props.cameras.length}</b> cameras</span><span><b>{props.incidents.length}</b> matching incidents</span><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue ↗</a></div>
  </section>;
}
