## Configuration Hardware Acceleration
Satyr supports the NVENC and VA-API hardware acceleration APIs. If you've configured your system correctly (the hard part) it should be enough to set the type and use the default device setting if you only have one hardware acceleration device.

### System
Configuring the system for any hardware acceleration API involves three main steps: selecting the right drivers, installing the API libraries, and configuring ffmpeg.

#### NVENC
NVENC in ffmpeg can work with either open-source drivers (nouvea) or nvidia's proprietary drivers. The documentation for your distribution should have instructions for installing these.

The only system library you should need is the CUDA toolkit, general named cudatoolkit, nvidia-cuda-toolkit, or some variation in your system repositories.
You can also try installing manually from [here](https://developer.nvidia.com/cuda-downloads).

Most binary distributions provide a version of ffmpeg with NVENC already enabled. If not you can try compiling ffmpeg from source with the `--enable-nvenc` flag. If you use a source based distribution you should be familiar with enabling optional compile flags.

You can verify that ffmpeg has been set up correctly by checking the output of `ffmpeg -hide_banner -hwaccels | grep cuvid` and `ffmpeg -hide_banner -encoders | grep nvenc`. If you don't see anything, something is wrong.

#### VA-API
VA-API is an extremely generic API. Although the package names might be different in your distribution, the arch wiki page for hardware acceleration has good information on [driver selection](https://wiki.archlinux.org/index.php/Hardware_video_acceleration#Installation) and [verifying](https://wiki.archlinux.org/index.php/Hardware_video_acceleration#Verifying_VA-API) a VA-API install for a wide range of devices.

Regardless of driver selection, you will also need libva or the equivalent from your distrubtion, and libva-utils can be helpful as well.

Most binary distributions provide a version of ffmpeg with VA-API already enabled. If not you can try compiling ffmpeg from source with the `--enable-vaapi` flag. If you use a source based distribution you should be familiar with enabling optional compile flags.

You can verify that ffmpeg has been set up correctly by checking the output of `ffmpeg -hide_banner -hwaccels | grep vaapi` and `ffmpeg -hide_banner -encoders | grep vaapi`. If you don't see anything, something is wrong.

### Satyr
```
# Decoding
hwaccel:
# Enable hardware acceleration for decoding as well as encoding.
# Probably not worth it, hardware decoding won't be any faster compared to software on a vaguely modern CPU
# Hardware decoding also may not support the input format, in which case transcoding will fail
  decode: true

# Only supported for VA-API
# Fall back to software decoding if hardware decoding fails
hwaccel:
  decode: 'fallback'


# NVENC
hwaccel:
  type: 'nvenc'
# device is optional for nvenc
  device: 0
# nvenc wants a device number instead of a path, set to null to disable

# VA-API
hwaccel:
  type: 'vaapi'
# device is mandatory for va-api
  device: '/dev/dri/renderD128'
```