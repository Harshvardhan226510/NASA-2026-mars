import hashlib
import stat
import tempfile
import unittest
from pathlib import Path
import zipfile
from science.voice_pack import extract_request

class VoiceExtractionTests(unittest.TestCase):
    def case(self,name='engine/file.bin',content=b'test',symlink=False,expected_hash=None):
        temporary=tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root=Path(temporary.name);archive=root/'voice.zip';out=root/'out';out.mkdir()
        with zipfile.ZipFile(archive,'w') as z:
            item=zipfile.ZipInfo(name)
            item.external_attr=((stat.S_IFLNK|0o777) if symlink else (stat.S_IFREG|0o644))<<16
            z.writestr(item,content)
        return {'archive':str(archive),'destination':str(out),'files':[{'path':name,'bytes':len(content),'sha256':expected_hash or hashlib.sha256(content).hexdigest()}]},out
    def test_regular_listed_hashed_file_installs(self):
        request,out=self.case()
        self.assertEqual(extract_request(request)['files'],1)
        self.assertEqual((out/'engine/file.bin').read_bytes(),b'test')
    def test_legitimate_espeak_variant_path(self):
        request,out=self.case('engine/voices/!v/Mr serious')
        self.assertEqual(extract_request(request)['files'],1)
        self.assertEqual((out/'engine/voices/!v/Mr serious').read_bytes(),b'test')
    def test_traversal_rejected_before_any_write(self):
        for name in ('../escape','/absolute','engine/../../escape','CON.txt','engine/file.'):
            request,out=self.case(name)
            with self.assertRaises(ValueError):extract_request(request)
            self.assertEqual(list(out.iterdir()),[])
    def test_links_are_rejected(self):
        request,out=self.case(symlink=True)
        with self.assertRaises(ValueError):extract_request(request)
        self.assertEqual(list(out.iterdir()),[])
    def test_hash_mismatch_rejects(self):
        request,_=self.case(expected_hash='0'*64)
        with self.assertRaisesRegex(ValueError,'checksum'):extract_request(request)
    def test_unlisted_entry_rejects(self):
        request,out=self.case()
        with zipfile.ZipFile(request['archive'],'a') as z:z.writestr('extra.bin',b'extra')
        with self.assertRaises(ValueError):extract_request(request)
        self.assertEqual(list(out.iterdir()),[])
