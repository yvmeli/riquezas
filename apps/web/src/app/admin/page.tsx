import { notFound } from 'next/navigation';
import Admin from './view';
export const dynamic = 'force-dynamic';
export default function Page(){if(process.env.PORTAL_MODE!=='admin')notFound();return <Admin/>;}
