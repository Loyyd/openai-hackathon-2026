'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Maximize } from 'lucide-react';
import { useApplication } from './ApplicationProvider';
import type { Camera, Incident, Selection, TransportObservation } from '../types';

const CityMap = dynamic(() => import('./CityMap'), { ssr: false, loading: () => <div className="map-loading">Loading Dublin map…</div> });
export interface MapProps { cameras: Camera[]; incidents: Incident[]; transport: TransportObservation[]; selection: Selection; onSelect: (selection: Selection) => void }
export function MapPanel(props: MapProps) {
  const { mapLayers: layers, setMapLayers: setLayers } = useApplication();
  const [fit, setFit] = useState(0);
  return <section className="map-panel" aria-label="Dublin incident map">
    <div className="section-heading"><div><span className="eyebrow">SPATIAL OVERVIEW</span><h2>Dublin, Ireland</h2></div><button className="icon-button" aria-label="Fit Dublin coverage" title="Fit Dublin coverage" onClick={() => setFit((value) => value + 1)}><Maximize size={17} /></button></div>
    <fieldset className="map-layers"><legend className="sr-only">Map layers</legend>
      {(['cameras', 'incidents', 'transport'] as const).map((layer) => <label key={layer}><input type="checkbox" checked={layers[layer]} onChange={(event) => setLayers({ ...layers, [layer]: event.target.checked })} /><i className={'legend-' + layer} />{layer[0].toUpperCase() + layer.slice(1)}</label>)}
    </fieldset>
    <CityMap {...props} layers={layers} fit={fit} />
    <div className="map-footer"><span><b>{props.cameras.length}</b> cameras</span><span><b>{props.incidents.length}</b> matching incidents</span><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue ↗</a></div>
  </section>;
}
