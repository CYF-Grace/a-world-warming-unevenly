"""从已有 NPZ 导出网页数据，不重新下载 CMIP6。
用法：python export_web_data.py --scenario /path/scenariomip_cesm2.npz
默认读取同目录 scenariomip_cesm2.npz，输出同目录 climate.json。只顺序解压所需温度层，不把整个大数组装入内存。
"""
import argparse,json,zipfile
from pathlib import Path
import numpy as np

SCENARIOS=('ssp585','ssp370','ssp245','ssp126')
STORIES={'california':(-125,-114,32,42),'india':(68,89,7,35),'china':(100,122,24,35),'amazon':(-74,-50,-15,5),'southeast':(102,127,8,22)}
REGIONS={'north_america':(-170,-50,15,75),'south_america':(-82,-34,-56,14),'europe':(-15,40,35,72),'north_africa':(-18,40,15,35),'sub_saharan':(-18,52,-35,15),'west_asia':(40,65,12,50),'south_asia':(65,90,5,35),'east_asia':(90,145,20,55),'southeast_asia':(90,145,-10,20),'oceania':(110,180,-50,-10)}

def read_feature(path,group,name):
    with np.load(path,allow_pickle=False) as z:
        names=z[group+'__variable_names'].tolist();index=names.index(name)
        lat=z[group+'__lat'];lon=z[group+'__lon'];times=z[group+'__time']
    with zipfile.ZipFile(path) as archive,archive.open(group+'__data.npy') as f:
        version=np.lib.format.read_magic(f)
        reader={(1,0):np.lib.format.read_array_header_1_0,(2,0):np.lib.format.read_array_header_2_0}.get(version)
        if reader is None:raise ValueError(f'不支持的 NPY 版本 {version}')
        shape,fortran,dtype=reader(f)
        if fortran or len(shape)!=4:raise ValueError('需要按变量、时间、纬度、经度存储的 C 顺序数组')
        size=int(np.prod(shape[1:]))*dtype.itemsize
        print('读取',group,name,'变量序号',index,flush=True)
        skip=index*size
        while skip:
            block=f.read(min(skip,16*1024**2))
            if not block:raise EOFError('NPZ 数据提前结束')
            skip-=len(block)
        raw=f.read(size)
        if len(raw)!=size:raise EOFError('温度层不完整')
        values=np.frombuffer(raw,dtype=dtype).reshape(shape[1:])
        return values,lat,lon,times

def clean(value):
    if isinstance(value,np.ndarray):return clean(value.tolist())
    if isinstance(value,list):return [clean(x) for x in value]
    if isinstance(value,dict):return {k:clean(v) for k,v in value.items()}
    if isinstance(value,(np.floating,float)):return round(float(value),3) if np.isfinite(value) else None
    if isinstance(value,np.integer):return int(value)
    return value

def export(scenario,output):
    payload={'source':'NCAR CESM2 · ScenarioMIP · r1i1p1f1','baseline':'2015–2034','scenarios':{},'regionDefinitions':{'stories':STORIES,'regions':REGIONS},'regionNote':'Regions are explicit geographic boxes, not political boundaries; regional means cover all grid cells inside each box.'}
    all_region_values=[]
    reference=None
    for group in SCENARIOS:
        a,lat,lon,times=read_feature(scenario,group,'Amon__tas')
        lon=((lon+180)%360)-180;order=np.argsort(lon);lon=lon[order];a=a[:,:,order]
        if reference is None:reference=(lat.copy(),lon.copy())
        elif not np.allclose(lat,reference[0]) or not np.allclose(lon,reference[1]):raise ValueError('情景网格不同')
        years=np.array([int(str(t)[:4]) for t in times]);year_list=sorted(set(years.tolist()))
        # 年均按 noleap 月长加权。任一月缺失，相应年格点为 NaN。
        month=np.array([int(str(t)[5:7]) for t in times]);days=np.array([31,28,31,30,31,30,31,31,30,31,30,31])
        annual=[]
        for year in year_list:
            mask=years==year
            if mask.sum()!=12 or len(set(month[mask]))!=12:raise ValueError(f'{group}/{year}: 非完整年份')
            annual.append(np.average(a[mask],axis=0,weights=days[month[mask]-1]))
        annual=np.array(annual);base_mask=(np.array(year_list)>=2015)&(np.array(year_list)<=2034)
        if base_mask.sum()!=20:raise ValueError('缺少完整共同基准 2015–2034')
        # 使用同一 SSP585 基准场，避免按情景分别减去不同基准而抹掉真实差异。
        if group=='ssp585':baseline=np.mean(annual[base_mask],axis=0)
        anomaly=annual-baseline
        edges=np.r_[-90,(lat[:-1]+lat[1:])/2,90];weights=np.diff(np.sin(np.deg2rad(edges)))[:,None]*np.ones((1,len(lon)))
        def average(field,mask=None):
            good=np.isfinite(field)
            if mask is not None:good &= mask
            return float(np.sum(field[good]*weights[good])/np.sum(weights[good])) if good.any() else float('nan')
        def region_mask(box):
            x0,x1,y0,y1=box;return (lat[:,None]>=y0)&(lat[:,None]<y1)&(lon[None,:]>=x0)&(lon[None,:]<x1)
        frames=[]
        # 4x4 合并保留约 5° 网格；NaN 不参与空间平均，全部缺失则仍为 NaN。
        stride=4;ny=len(lat)//stride;nx=len(lon)//stride
        coarse_lat=lat[:ny*stride].reshape(ny,stride).mean(axis=1)
        coarse_lon=lon[:nx*stride].reshape(nx,stride).mean(axis=1)
        for i,year in enumerate(year_list):
            field=np.mean(anomaly[max(0,i-4):min(len(year_list),i+6)],axis=0)
            small=field[:ny*stride,:nx*stride].reshape(ny,stride,nx,stride)
            w=weights[:ny*stride,:nx*stride].reshape(ny,stride,nx,stride)
            good=np.isfinite(small);den=np.where(good,w,0).sum(axis=(1,3));num=np.where(good,small*w,0).sum(axis=(1,3))
            coarse=np.divide(num,den,out=np.full((ny,nx),np.nan),where=den>0)
            regions={k:average(field,region_mask(box)) for k,box in REGIONS.items()}
            all_region_values.extend(v for v in regions.values() if np.isfinite(v))
            frames.append({'global':average(field),'grid':coarse.ravel(),'regions':regions,'stories':{k:average(field,region_mask(box)) for k,box in STORIES.items()}})
        payload['lat']=coarse_lat;payload['lon']=coarse_lon
        payload['scenarios'][group]={'years':year_list,'frames':frames}
        del a,annual,anomaly
    payload['maxRegionalWarming']=max(1,float(np.ceil(max(all_region_values))))
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(clean(payload),ensure_ascii=False,separators=(',',':'),allow_nan=False))
    print('保存',output,output.stat().st_size/1024**2,'MiB')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--scenario',default=str(Path(__file__).parent/'scenariomip_cesm2.npz'));p.add_argument('--output',default=str(Path(__file__).parent/'climate.json'))
    args=p.parse_args();export(args.scenario,args.output)
