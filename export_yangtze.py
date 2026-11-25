"""python export_yangtze.py --input ls3mip_cesm2.npz
顺序读取一次压缩数组；只保留区域格点。输出与网页同目录的 yangtze.json。
"""
import argparse
import json
import zipfile
from pathlib import Path
import numpy as np
from export_web_data import clean

GROUP = 'land-hist'
FIELDS = {'temperature': 'Amon__tas', 'soil': 'Lmon__mrsos',
          'gpp': 'Lmon__gpp', 'lai': 'Lmon__lai', 'nbp': 'Lmon__nbp'}
DAYS = np.array([31,28,31,30,31,30,31,31,30,31,30,31])

def export(source, output, baseline=(1981, 2010)):
    with np.load(source, allow_pickle=False) as z:
        names = z[GROUP+'__variable_names'].tolist()
        lat = z[GROUP+'__lat']; lon = (z[GROUP+'__lon']+180)%360-180
        times = z[GROUP+'__time'].astype(str)
    iy = np.flatnonzero((lat >= 24)&(lat <= 35))
    ix = np.flatnonzero((lon >= 100)&(lon <= 122))
    iy = iy[np.argsort(lat[iy])]; ix = ix[np.argsort(lon[ix])]
    if not len(iy) or not len(ix): raise ValueError('区域内没有格点')
    years = np.array([int(t[:4]) for t in times])
    months = np.array([int(t[5:7]) for t in times])
    if len(set(zip(years,months))) != len(times): raise ValueError('存在重复月份')
    summer_years = sorted(set(years[(months>=6)&(months<=8)].tolist()))
    selections = [np.flatnonzero((years==y)&(months>=6)&(months<=8)) for y in summer_years]
    for y, ids in zip(summer_years,selections):
        if sorted(months[ids].tolist()) != [6,7,8]: raise ValueError(f'{y} 夏季不完整')
    targets = {names.index(v):k for k,v in FIELDS.items() if v in names}
    for key in ('temperature','soil','gpp'):
        if FIELDS[key] not in names: raise ValueError(f'缺少 {FIELDS[key]}')
    values = {}
    with zipfile.ZipFile(source) as archive, archive.open(GROUP+'__data.npy') as f:
        version = np.lib.format.read_magic(f)
        reader = {(1,0):np.lib.format.read_array_header_1_0,(2,0):np.lib.format.read_array_header_2_0}.get(version)
        if reader is None: raise ValueError(f'不支持 NPY {version}')
        shape, fortran, dtype = reader(f)
        expected = (len(names),len(times),len(lat),len(lon))
        if fortran or shape != expected or dtype.kind not in 'fi':
            raise ValueError(f'需要 C 顺序的数值数组 {expected}，实际 {shape}')
        plane_bytes = len(lat)*len(lon)*dtype.itemsize
        for index in range(max(targets)+1):
            key = targets.get(index)
            if key: print('读取',names[index],flush=True)
            regional = []
            for _ in times:
                raw = f.read(plane_bytes)
                if len(raw)!=plane_bytes: raise EOFError('数组提前结束')
                if key:
                    plane = np.frombuffer(raw,dtype=dtype).reshape(len(lat),len(lon))
                    regional.append(plane[np.ix_(iy,ix)].astype(float).ravel())
            if not key: continue
            regional = np.array(regional)
            summer = []
            for ids in selections:
                weights = DAYS[months[ids]-1]
                # 普通 sum/average：任何一个月 NaN，整格该夏季 NaN。
                if key in ('gpp','nbp'):
                    a = np.sum(regional[ids]*weights[:,None]*86400*1000,axis=0)
                else: a = np.average(regional[ids],axis=0,weights=weights)
                summer.append(a-273.15 if key=='temperature' else a)
            values[key] = np.array(summer)
    base = (np.array(summer_years)>=baseline[0])&(np.array(summer_years)<=baseline[1])
    if base.sum()!=baseline[1]-baseline[0]+1: raise ValueError('基准期不完整')
    reference = {k:np.mean(v[base],axis=0) for k,v in values.items()}
    frames = [{ 'year':y, **{k:v[i] for k,v in values.items()},
               'nbp': values['nbp'][i] if 'nbp' in values else None}
              for i,y in enumerate(summer_years)]
    def domain(a):
        good = a[np.isfinite(a)]
        return [float(good.min()),float(good.max())] if good.size else [0,1]
    payload = {'source':'CESM2 / LS3MIP / land-hist / r1i1p1f1',
        'season':'JJA', 'calendar':'noleap', 'baseline':list(baseline),
        'regionNote':'100–122°E、24–35°N 代表区域框，并非精确长江流域边界',
        'lat':lat[iy], 'lon':lon[ix], 'reference':reference, 'frames':frames,
        'units':{'temperature':'°C','soil':'kg m⁻²（表层土壤水）','gpp':'g C m⁻² / 夏季','nbp':'g C m⁻² / 夏季','lai':'m² m⁻²'},
        'domains':{k:domain(v) for k,v in values.items()},
        'availability':{k:k in values for k in FIELDS},
        'notes':['历史陆面模拟，不是观测或2022事件重建。','GPP是总光合吸碳，不是净碳汇。NBP缺失时保留null，不以GPP替代。','时间平均严格传播NaN；基准期任一夏季缺失也传播。','LAI基准掩膜仅表示高叶面积植被，不能识别森林。']}
    output = Path(output); output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(clean(payload),ensure_ascii=False,allow_nan=False,separators=(',',':')),encoding='utf-8')
    print('已保存',output,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input',type=Path,default=Path(__file__).with_name('ls3mip_cesm2.npz'))
    p.add_argument('--output',type=Path,default=Path(__file__).with_name('yangtze.json'))
    a=p.parse_args(); export(a.input,a.output)
